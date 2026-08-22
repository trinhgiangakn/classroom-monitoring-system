#include "task_mqtt.h"
#include "shared_data.h"
#include "config.h"
#include <WiFiClientSecure.h>
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>

// Global variables for MQTT client, queue, and current configuration.
WiFiClientSecure espClient;
PubSubClient mqtt_client(espClient);
QueueHandle_t mqtt_queue;

// Current Wi-Fi and MQTT configuration stored in NVS.
String current_ssid, current_pass, current_mqtt;
const String NODE_IDS[4] = {NODE_1, NODE_2, NODE_3, NODE_4};

// Function to load Wi-Fi and MQTT configuration from NVS (Non-Volatile Storage).
void load_config_from_nvs() {
    nvs.begin("config", false);

    if (!nvs.isKey("ssid")) nvs.putString("ssid", WIFI_SSID_DEFAULT);
    if (!nvs.isKey("pass")) nvs.putString("pass", WIFI_PASS_DEFAULT);
    if (!nvs.isKey("mqtt")) nvs.putString("mqtt", MQTT_SERVER_DEFAULT);

    current_ssid = nvs.getString("ssid", WIFI_SSID_DEFAULT);
    current_pass = nvs.getString("pass", WIFI_PASS_DEFAULT);
    current_mqtt = nvs.getString("mqtt", MQTT_SERVER_DEFAULT);
    
    nvs.end();
}

// Function to initialize Wi-Fi and MQTT client, and create the MQTT message queue.
void init_wifi_and_mqtt() {
    WiFi.disconnect(true, true);
    delay(100);

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(current_ssid.c_str(), current_pass.c_str());
    
    Serial.printf("\n[WIFI] Đang bắt tay với SSID: %s\n", current_ssid.c_str());

    espClient.setInsecure();
    espClient.setTimeout(5);
    mqtt_client.setBufferSize(512);
    mqtt_client.setServer(current_mqtt.c_str(), MQTT_PORT_DEFAULT);
    
    mqtt_queue = xQueueCreate(15, sizeof(mqtt_msg_t));
}

// MQTT callback function to handle incoming messages and commands.
void mqtt_callback(char* topic, byte* payload, unsigned int length) {
    if (length >= 256) return;
    char payload_str[256];
    memcpy(payload_str, payload, length);
    payload_str[length] = '\0'; 
    
    StaticJsonDocument<256> doc;
    if (deserializeJson(doc, payload_str)) return;

    if (doc.containsKey("cmd")) {
        const char* cmd = doc["cmd"];
        if (strcmp(cmd, "set_mode") == 0) {
            if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
                is_auto_mode = doc["auto"];
                xSemaphoreGive(config_mutex);
            }
        }
        else if (strcmp(cmd, "set_thresh") == 0) {
            if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
                if (doc.containsKey("temp")) system_thresh.thresh_temp = doc["temp"];
                if (doc.containsKey("humid")) system_thresh.thresh_humid = doc["humid"];
                if (doc.containsKey("light_low")) system_thresh.thresh_light_low = doc["light_low"];
                if (doc.containsKey("light_high")) system_thresh.thresh_light_high = doc["light_high"];
                if (doc.containsKey("api")) system_thresh.thresh_api = doc["api"];
                xSemaphoreGive(config_mutex);
            }
        }
    } 
    else if (doc.containsKey("command")) {
        bool current_auto = true;
        if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
            current_auto = is_auto_mode;
            xSemaphoreGive(config_mutex);
        }

        if (!current_auto) {
            const char* device_id = "";
            int relay_pin = -1;
            bool is_on = false;

            if (strstr(topic, DEV_FAN))             { device_id = DEV_FAN; relay_pin = RELAY_FAN; }
            else if (strstr(topic, DEV_LIGHT))      { device_id = DEV_LIGHT; relay_pin = RELAY_LIGHT; }
            else if (strstr(topic, DEV_CURTAIN))    { device_id = DEV_CURTAIN; relay_pin = RELAY_CURTAIN; }
            else if (strstr(topic, DEV_HUMIDIFIER)) { device_id = DEV_HUMIDIFIER; relay_pin = RELAY_HUMIDIFIER; }
            else return; 

            const char* cmd = doc["command"];
            if (strstr(cmd, "TURN_ON") || strstr(cmd, "OPEN")) {
                digitalWrite(relay_pin, RELAY_ON);
                is_on = true;
            }
            else if (strstr(cmd, "TURN_OFF") || strstr(cmd, "CLOSE")) {
                digitalWrite(relay_pin, RELAY_OFF);
                is_on = false;
            }
        }
    }
}

// Task to manage MQTT connection, message publishing, and subscription handling.
void task_mqtt_unified(void *pvParameters) {
    mqtt_client.setCallback(mqtt_callback);
    for (;;) {
        if (WiFi.status() != WL_CONNECTED) {
            is_mqtt_connected = false;
            vTaskDelay(3000 / portTICK_PERIOD_MS);
            continue;
        }

        if (!mqtt_client.connected()) {
            is_mqtt_connected = false;
            String clientId = "GW-P101-" + String(random(0xffff), HEX);
            if (mqtt_client.connect(clientId.c_str(), MQTT_USER, MQTT_PASS)) {
                is_mqtt_connected = true;
                char cmd_sub[64];
                snprintf(cmd_sub, sizeof(cmd_sub), "%s+/command", TOPIC_PREFIX_DEVICE);
                mqtt_client.subscribe(cmd_sub);
            } else {
                vTaskDelay(3000 / portTICK_PERIOD_MS);
                continue;
            }
        } else {
            is_mqtt_connected = true;
            mqtt_client.loop();

            mqtt_msg_t tx_msg;
            if (xQueuePeek(mqtt_queue, &tx_msg, 10 / portTICK_PERIOD_MS) == pdPASS) {
                if (mqtt_client.publish(tx_msg.topic, tx_msg.payload)) {
                    xQueueReceive(mqtt_queue, &tx_msg, 0); 
                } else {
                    is_mqtt_connected = false;
                    vTaskDelay(3000 / portTICK_PERIOD_MS);
                }
            }
        }
        vTaskDelay(20 / portTICK_PERIOD_MS); 
    }
}

// Task to periodically send gateway health metrics to the MQTT broker.
void task_gateway_health(void *pvParameters) {
    for (;;) {
        if (is_mqtt_connected) {
            char metrics_topic[64];
            snprintf(metrics_topic, sizeof(metrics_topic), "%s", TOPIC_GATEWAY_METRICS);

            StaticJsonDocument<256> doc;
            doc["free_heap"] = ESP.getFreeHeap();
            doc["uptime_ms"] = millis();
            doc["wifi_rssi"] = WiFi.RSSI();
            doc["mqtt_connected"] = is_mqtt_connected;
            
            // Include queue metrics if the MQTT queue is initialized.
            if (mqtt_queue != NULL) {
                doc["queue_waiting"] = uxQueueMessagesWaiting(mqtt_queue);
                doc["queue_free"] = uxQueueSpacesAvailable(mqtt_queue);
            }

            char payload[256];
            serializeJson(doc, payload, sizeof(payload));

            mqtt_client.publish(metrics_topic, payload);
        }
        vTaskDelay(30000 / portTICK_PERIOD_MS); 
    }
}