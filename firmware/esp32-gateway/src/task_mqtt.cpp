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

    current_ssid = WIFI_SSID_DEFAULT;
    current_pass = WIFI_PASS_DEFAULT;
    current_mqtt = MQTT_SERVER_DEFAULT;

    if (nvs.isKey("t_max")) {
        system_thresh.thresh_temp_max  = nvs.getFloat("t_max",  30.0);
        system_thresh.thresh_temp_min  = nvs.getFloat("t_min",  28.0);
        system_thresh.thresh_humid_max = nvs.getFloat("h_max",  60.0);
        system_thresh.thresh_humid_min = nvs.getFloat("h_min",  50.0);
        system_thresh.thresh_light_high = nvs.getFloat("l_high", 800.0);
        system_thresh.thresh_light_low  = nvs.getFloat("l_low",  300.0);
    }
    nvs.end();
}

// Function to initialize Wi-Fi and MQTT client, and create the MQTT message queue.
void init_wifi_and_mqtt() {
    WiFi.disconnect(true, true);
    delay(100);

    WiFi.mode(WIFI_STA);
    WiFi.setAutoReconnect(true);
    WiFi.begin(current_ssid.c_str(), current_pass.c_str());
    
    Serial.printf("\n[WIFI] Dang ket noi voi SSID: %s\n", current_ssid.c_str());

    espClient.setInsecure();
    espClient.setTimeout(5);
    mqtt_client.setBufferSize(2048);
    mqtt_client.setServer(current_mqtt.c_str(), MQTT_PORT_DEFAULT);
    
    mqtt_queue = xQueueCreate(15, sizeof(mqtt_msg_t));
}

// MQTT callback function to handle incoming messages and commands.
void mqtt_callback(char* topic, byte* payload, unsigned int length) {
    if (length >= 1024) return;
    char payload_str[1024];
    memcpy(payload_str, payload, length);
    payload_str[length] = '\0'; 
    
    StaticJsonDocument<1024> doc;
    if (deserializeJson(doc, payload_str)) return;

    // Handle configuration update messages for thresholds
    if (doc.containsKey("thresholds") || (doc.containsKey("event") && (doc["event"] == "CONFIG_UPDATE" || doc["event"] == "THRESHOLDS_UPDATE" || doc["event"] == "RULE_TOGGLE"))) {
        bool updated = false;

        if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
            if (doc.containsKey("thresholds")) {
                JsonObject thresh = doc["thresholds"].as<JsonObject>();
                if (!thresh.isNull()) {
                    if (thresh.containsKey("temp_on"))             { system_thresh.thresh_temp_max = thresh["temp_on"].as<float>(); updated = true; }
                    if (thresh.containsKey("temp_off"))            { system_thresh.thresh_temp_min = thresh["temp_off"].as<float>(); updated = true; }
                    if (thresh.containsKey("humidity_on"))         { system_thresh.thresh_humid_min = thresh["humidity_on"].as<float>(); updated = true; }
                    if (thresh.containsKey("humidity_off"))        { system_thresh.thresh_humid_max = thresh["humidity_off"].as<float>(); updated = true; }
                    if (thresh.containsKey("light_curtain_close")) { system_thresh.thresh_light_high = thresh["light_curtain_close"].as<float>(); updated = true; }
                    if (thresh.containsKey("light_lamp_on"))       { system_thresh.thresh_light_low = thresh["light_lamp_on"].as<float>(); updated = true; }
                }
            } else {
                if (doc.containsKey("temp_on"))             { system_thresh.thresh_temp_max = doc["temp_on"].as<float>(); updated = true; }
                if (doc.containsKey("temp_off"))            { system_thresh.thresh_temp_min = doc["temp_off"].as<float>(); updated = true; }
                if (doc.containsKey("humidity_on"))         { system_thresh.thresh_humid_min = doc["humidity_on"].as<float>(); updated = true; }
                if (doc.containsKey("humidity_off"))        { system_thresh.thresh_humid_max = doc["humidity_off"].as<float>(); updated = true; }
                if (doc.containsKey("light_curtain_close")) { system_thresh.thresh_light_high = doc["light_curtain_close"].as<float>(); updated = true; }
                if (doc.containsKey("light_lamp_on"))       { system_thresh.thresh_light_low = doc["light_lamp_on"].as<float>(); updated = true; }
            }

            if (updated) {
                nvs.begin("config", false); 
                nvs.putFloat("t_max", system_thresh.thresh_temp_max);
                nvs.putFloat("t_min", system_thresh.thresh_temp_min);
                nvs.putFloat("h_max", system_thresh.thresh_humid_max);
                nvs.putFloat("h_min", system_thresh.thresh_humid_min);
                nvs.putFloat("l_high", system_thresh.thresh_light_high);
                nvs.putFloat("l_low", system_thresh.thresh_light_low);
                nvs.end(); 
                Serial.println("[NVS] Da luu cau hinh Thresholds thanh cong!");
            }
            xSemaphoreGive(config_mutex);
        }
        
        StaticJsonDocument<256> ack_doc;
        ack_doc["event"] = "CONFIG_ACK";
        ack_doc["room_id"] = doc.containsKey("room_id") ? doc["room_id"].as<const char*>() : "P.101";
        ack_doc["status"] = "SUCCESS";
        ack_doc["stored_in_eeprom"] = true;
        
        char ack_payload[256];
        serializeJson(ack_doc, ack_payload);
        
        mqtt_client.publish("classroom/P.101/gateway/ack", ack_payload); 
        Serial.println("[MQTT] Da cap nhat Rule va gui CONFIG_ACK");
        return; 
    }

    // Handle command messages for device control or mode change (AUTO/MANUAL)
    if (doc.containsKey("action") && doc.containsKey("command_id")) {
        const char* cmd_id = doc["command_id"];
        const char* dev_id = doc.containsKey("device_id") ? doc["device_id"].as<const char*>() : "GATEWAY";
        const char* action = doc["action"];

        bool is_switching_mode = false;
        const char* target_mode = nullptr;

        // Check if payload contains source mode change (AUTO or MANUAL)
        if (doc.containsKey("source")) {
            const char* source_str = doc["source"];
            if (source_str != nullptr) {
                if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
                    if (strcmp(source_str, "AUTO") == 0) {
                        is_auto_mode = true;
                        is_switching_mode = true;
                        target_mode = "AUTO";
                    } else if (strcmp(source_str, "MANUAL") == 0) {
                        is_auto_mode = false;
                        is_switching_mode = true;
                        target_mode = "MANUAL";
                    }
                    xSemaphoreGive(config_mutex);
                }
            }
        }

        // Send ACK for mode change (ALL or GATEWAY) for both AUTO and MANUAL
        if (is_switching_mode && (strcmp(dev_id, "ALL") == 0 || strcmp(dev_id, "GATEWAY") == 0)) {
            StaticJsonDocument<256> ack_mode;
            ack_mode["event"]            = "COMMAND_ACK";
            ack_mode["command_id"]       = cmd_id;
            ack_mode["device_id"]        = dev_id;
            ack_mode["room_id"]          = "P.101";
            ack_mode["status"]           = "SUCCESS";
            ack_mode["execution_time_ms"] = 10;
            ack_mode["current_state"]    = strcmp(target_mode, "AUTO") == 0 ? "AUTO_MODE" : "MANUAL_MODE";
            ack_mode["actual_state"]     = strcmp(target_mode, "AUTO") == 0 ? "AUTO_MODE" : "MANUAL_MODE";

            if (doc.containsKey("timestamp")) {
                ack_mode["timestamp"] = doc["timestamp"];
            } else {
                ack_mode["timestamp"] = millis();
            }

            char ack_payload[256];
            serializeJson(ack_mode, ack_payload);

            mqtt_client.publish("classroom/P.101/gateway/ack", ack_payload);
            Serial.printf("[MQTT] Da chuyen sang che do %s va gui ACK thanh cong!\n", target_mode);
            return;
        }

        bool current_auto = true;
        if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
            current_auto = is_auto_mode;
            xSemaphoreGive(config_mutex);
        }

        // MANUAL mode
        if (!current_auto) {
            uint32_t start_time = micros();
            int relay_pin = -1;
            bool is_on = false;

            if (strcmp(dev_id, "FAN_01") == 0)             { relay_pin = RELAY_FAN; }
            else if (strcmp(dev_id, "LIGHT_01") == 0)      { relay_pin = RELAY_LIGHT; }
            else if (strcmp(dev_id, "CURTAIN_01") == 0)    { relay_pin = RELAY_CURTAIN; }
            else if (strcmp(dev_id, "HUMIDIFIER_01") == 0) { relay_pin = RELAY_HUMIDIFIER; }
            else return;

            if (strcmp(action, "TURN_ON") == 0 || strcmp(action, "OPEN") == 0) {
                digitalWrite(relay_pin, RELAY_ON);
                is_on = true;
            } else if (strcmp(action, "TURN_OFF") == 0 || strcmp(action, "CLOSE") == 0) {
                digitalWrite(relay_pin, RELAY_OFF);
                is_on = false;
            }

            uint32_t end_time = micros();
            float real_exec_time_ms = (end_time - start_time) / 1000.0;
            const char* state_str = is_on ? "ON" : "OFF";

            StaticJsonDocument<256> ack_manual;
            ack_manual["event"]            = "COMMAND_ACK";
            ack_manual["command_id"]       = cmd_id;
            ack_manual["device_id"]        = dev_id;
            ack_manual["room_id"]          = "P.101";
            ack_manual["status"]           = "SUCCESS";
            ack_manual["execution_time_ms"] = real_exec_time_ms;
            ack_manual["current_state"]    = state_str;
            ack_manual["actual_state"]     = state_str;

            if (doc.containsKey("timestamp")) {
                ack_manual["timestamp"] = doc["timestamp"];
            } else {
                ack_manual["timestamp"] = millis();
            }

            char ack_payload[256];
            serializeJson(ack_manual, ack_payload);

            char ack_topic[128];
            snprintf(ack_topic, sizeof(ack_topic), "classroom/P.101/device/%s/ack", dev_id);
            mqtt_client.publish(ack_topic, ack_payload);

            Serial.printf("[MQTT] Da gui ACK MANUAL cho thiet bi: %s (%s)\n", dev_id, state_str);
        } else {
            Serial.println("[MQTT] He thong dang o che do AUTO, tu choi lenh MANUAL!");
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
                
                // Subscribe to device commands
                char cmd_sub[64];
                snprintf(cmd_sub, sizeof(cmd_sub), "%s+/command", TOPIC_PREFIX_DEVICE);
                mqtt_client.subscribe(cmd_sub);

                // Subscribe to threshold configuration updates from Backend
                mqtt_client.subscribe("classroom/P.101/config/thresholds");

                Serial.println("[MQTT] Connected & Subscribed to command + config topics!");

                auto publish_relay_state = [](const char* dev_id, int pin) {
                    StaticJsonDocument<192> doc;
                    doc["event"]        = "COMMAND_ACK";
                    doc["device_id"]    = dev_id;
                    doc["actual_state"] = (digitalRead(pin) == RELAY_ON) ? "ON" : "OFF";
                    doc["status"]       = "SUCCESS";
                    doc["source"]       = "BOOT_SYNC";
                    char payload[192], topic[64];
                    serializeJson(doc, payload);
                    snprintf(topic, sizeof(topic), "classroom/P.101/device/%s/ack", dev_id);
                    mqtt_client.publish(topic, payload);
                };

                publish_relay_state("FAN_01",        RELAY_FAN);
                publish_relay_state("LIGHT_01",      RELAY_LIGHT);
                publish_relay_state("CURTAIN_01",    RELAY_CURTAIN);
                publish_relay_state("HUMIDIFIER_01", RELAY_HUMIDIFIER);
                Serial.println("[MQTT] Da dong bo trang thai relay len backend!");
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