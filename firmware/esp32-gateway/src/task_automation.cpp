#include <Arduino.h>
#include <FreeRTOS.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "shared_data.h"
#include "task_mqtt.h"
#include "config.h"

// Helper: Publish relay state to MQTT when changed by AUTO mode
static void publish_auto_state(const char* device_id, const char* actual_state) {
    if (!is_mqtt_connected || mqtt_queue == NULL) return;

    mqtt_msg_t msg;
    snprintf(msg.topic, sizeof(msg.topic),"classroom/P.101/device/%s/ack", device_id);

    StaticJsonDocument<192> doc;
    doc["event"]        = "COMMAND_ACK";
    doc["device_id"]    = device_id;
    doc["actual_state"] = actual_state;
    doc["status"]       = "SUCCESS";
    doc["source"]       = "AUTO";
    doc["execution_time_ms"] = 0;
    serializeJson(doc, msg.payload, sizeof(msg.payload));

    xQueueSend(mqtt_queue, &msg, 0);
    Serial.printf("[AUTO] Published state: %s -> %s\n", device_id, actual_state);
}

// RTOS Task: Auto-control relays based on sensor data and thresholds
void task_automation(void *pvParameters) {
    for(;;) {
        bool is_connected = (WiFi.status() == WL_CONNECTED) && is_mqtt_connected;
        bool current_auto;
        threshold_config_t local_thresh;

        if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
            current_auto = is_auto_mode;
            local_thresh = system_thresh;
            xSemaphoreGive(config_mutex);
        }

        if (current_auto || !is_connected) {
            if (xSemaphoreTake(cache_mutex, portMAX_DELAY)) {
                for (int i = 0; i < 4; i++) {
                    if (!node_cache[i].is_online) continue;

                    if (millis() - node_cache[i].last_update > NODE_TIMEOUT_MS) {
                        node_cache[i].is_online = false;
                        continue;
                    }

                    // TEMPERATURE LOGIC (Fan)
                    if (node_cache[i].temp > local_thresh.thresh_temp_max) {
                        if (digitalRead(RELAY_FAN) != RELAY_ON) {
                            digitalWrite(RELAY_FAN, RELAY_ON);
                            publish_auto_state("FAN_01", "ON");
                        }
                    } else {
                        if (digitalRead(RELAY_FAN) != RELAY_OFF) {
                            digitalWrite(RELAY_FAN, RELAY_OFF);
                            publish_auto_state("FAN_01", "OFF");
                        }
                    }

                    // LIGHT LOGIC (Lamp & Curtain)
                    if (node_cache[i].light < local_thresh.thresh_light_low) {
                        if (digitalRead(RELAY_LIGHT) != RELAY_ON) {
                            digitalWrite(RELAY_LIGHT, RELAY_ON);
                            publish_auto_state("LIGHT_01", "ON");
                        }
                        if (digitalRead(RELAY_CURTAIN) != RELAY_OFF) {
                            digitalWrite(RELAY_CURTAIN, RELAY_OFF);
                            publish_auto_state("CURTAIN_01", "OFF");
                        }
                    } else if (node_cache[i].light > local_thresh.thresh_light_high) {
                        if (digitalRead(RELAY_CURTAIN) != RELAY_ON) {
                            digitalWrite(RELAY_CURTAIN, RELAY_ON);
                            publish_auto_state("CURTAIN_01", "ON");
                        }
                        if (digitalRead(RELAY_LIGHT) != RELAY_OFF) {
                            digitalWrite(RELAY_LIGHT, RELAY_OFF);
                            publish_auto_state("LIGHT_01", "OFF");
                        }
                    }
                    
                    //HUMIDITY LOGIC (Humidifier)
                    if (node_cache[i].humid > local_thresh.thresh_humid_max) {
                        if (digitalRead(RELAY_HUMIDIFIER) != RELAY_OFF) {
                            digitalWrite(RELAY_HUMIDIFIER, RELAY_OFF);
                            publish_auto_state("HUMIDIFIER_01", "OFF");
                        }
                    } else {
                        if (digitalRead(RELAY_HUMIDIFIER) != RELAY_ON) {
                            digitalWrite(RELAY_HUMIDIFIER, RELAY_ON);
                            publish_auto_state("HUMIDIFIER_01", "ON");
                        }
                    }
                }
                xSemaphoreGive(cache_mutex);
            }
        }

        vTaskDelay(2000 / portTICK_PERIOD_MS);
    }
}