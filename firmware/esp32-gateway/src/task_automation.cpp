#include <Arduino.h>
#include <FreeRTOS.h>
#include <WiFi.h>
#include <ArduinoJson.h>
#include "shared_data.h"
#include "task_mqtt.h"
#include "config.h"

// Publish relay state to MQTT when changed by AUTO mode.
static void publish_auto_state(const char* device_id, const char* actual_state) {
    if (!is_mqtt_connected || mqtt_queue == NULL) return;

    mqtt_msg_t msg;
    snprintf(msg.topic, sizeof(msg.topic), "classroom/P.101/device/%s/ack", device_id);

    StaticJsonDocument<192> doc;
    doc["event"]             = "COMMAND_ACK";
    doc["device_id"]         = device_id;
    doc["actual_state"]      = actual_state;
    doc["status"]            = "SUCCESS";
    doc["source"]            = "AUTO";
    doc["execution_time_ms"] = 0;
    serializeJson(doc, msg.payload, sizeof(msg.payload));

    xQueueSend(mqtt_queue, &msg, 0);
    Serial.printf("[AUTO] Published state: %s -> %s\n", device_id, actual_state);
}

// RTOS Task: Auto-control relays based on sensor data and thresholds.
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
                float sum_temp = 0.0f, sum_humid = 0.0f, sum_light = 0.0f;
                int online_count = 0;

                for (int i = 0; i < 4; i++) {
                    if (!node_cache[i].is_online) continue;

                    if (millis() - node_cache[i].last_update > NODE_TIMEOUT_MS) {
                        node_cache[i].is_online = false;
                        continue;
                    }

                    sum_temp  += node_cache[i].temp;
                    sum_humid += node_cache[i].humid;
                    sum_light += node_cache[i].light;
                    online_count++;
                }

                if (online_count > 0) {
                    float avg_temp  = sum_temp / online_count;
                    float avg_humid = sum_humid / online_count;
                    float avg_light = sum_light / online_count;

                    // TEMPERATURE LOGIC (Fan) - Hysteresis
                    if (avg_temp >= local_thresh.thresh_temp_max) {
                        if (digitalRead(RELAY_FAN) != RELAY_ON) {
                            digitalWrite(RELAY_FAN, RELAY_ON);
                            publish_auto_state("FAN_01", "ON");
                        }
                    } else if (avg_temp <= local_thresh.thresh_temp_min) {
                        if (digitalRead(RELAY_FAN) != RELAY_OFF) {
                            digitalWrite(RELAY_FAN, RELAY_OFF);
                            publish_auto_state("FAN_01", "OFF");
                        }
                    }

                    // LIGHT LOGIC (Lamp & Curtain) - Hysteresis
                    if (avg_light <= local_thresh.thresh_light_low) {
                        if (digitalRead(RELAY_LIGHT) != RELAY_ON) {
                            digitalWrite(RELAY_LIGHT, RELAY_ON);
                            publish_auto_state("LIGHT_01", "ON");
                        }
                        if (digitalRead(RELAY_CURTAIN) != RELAY_OFF) {
                            digitalWrite(RELAY_CURTAIN, RELAY_OFF);
                            publish_auto_state("CURTAIN_01", "OFF");
                        }
                    } else if (avg_light >= local_thresh.thresh_light_high) {
                        if (digitalRead(RELAY_CURTAIN) != RELAY_ON) {
                            digitalWrite(RELAY_CURTAIN, RELAY_ON);
                            publish_auto_state("CURTAIN_01", "ON");
                        }
                        if (digitalRead(RELAY_LIGHT) != RELAY_OFF) {
                            digitalWrite(RELAY_LIGHT, RELAY_OFF);
                            publish_auto_state("LIGHT_01", "OFF");
                        }
                    }

                    // HUMIDITY LOGIC (Humidifier) - Hysteresis
                    if (avg_humid >= local_thresh.thresh_humid_max) {
                        if (digitalRead(RELAY_HUMIDIFIER) != RELAY_OFF) {
                            digitalWrite(RELAY_HUMIDIFIER, RELAY_OFF);
                            publish_auto_state("HUMIDIFIER_01", "OFF");
                        }
                    } else if (avg_humid <= local_thresh.thresh_humid_min) {
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
