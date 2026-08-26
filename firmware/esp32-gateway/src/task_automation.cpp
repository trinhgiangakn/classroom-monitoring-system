#include <Arduino.h>
#include <FreeRTOS.h>
#include <WiFi.h>
#include "shared_data.h"
#include "config.h"

// RTOS Task: Auto-control relays based on sensor data and thresholds
void task_automation(void *pvParameters) {
    for(;;) {
        bool is_connected = (WiFi.status() == WL_CONNECTED) && is_mqtt_connected;
        threshold_config_t local_thresh;

        if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
            local_thresh = system_thresh;
            xSemaphoreGive(config_mutex);
        }

        // Online: Backend processes and sends commands. Offline: ESP32 controls itself.
        if (!is_connected) {
            if (xSemaphoreTake(cache_mutex, portMAX_DELAY)) {
                for (int i = 0; i < 4; i++) {
                    if (!node_cache[i].is_online) continue;

                    if (millis() - node_cache[i].last_update > NODE_TIMEOUT_MS) {
                        node_cache[i].is_online = false;
                        continue;
                    }

                    // TEMPERATURE LOGIC (Fan) - Hysteresis
                    if (node_cache[i].temp >= local_thresh.thresh_temp_max) {
                        if (digitalRead(RELAY_FAN) != RELAY_ON) {
                            digitalWrite(RELAY_FAN, RELAY_ON);
                            Serial.println("[OFFLINE] FAN -> ON");
                        }
                    } else if (node_cache[i].temp <= local_thresh.thresh_temp_min) {
                        if (digitalRead(RELAY_FAN) != RELAY_OFF) {
                            digitalWrite(RELAY_FAN, RELAY_OFF);
                            Serial.println("[OFFLINE] FAN -> OFF");
                        }
                    }

                    // LIGHT LOGIC (Lamp & Curtain) - Hysteresis
                    if (node_cache[i].light <= local_thresh.thresh_light_low) {
                        if (digitalRead(RELAY_LIGHT) != RELAY_ON) {
                            digitalWrite(RELAY_LIGHT, RELAY_ON);
                            Serial.println("[OFFLINE] LIGHT -> ON");
                        }
                        if (digitalRead(RELAY_CURTAIN) != RELAY_OFF) {
                            digitalWrite(RELAY_CURTAIN, RELAY_OFF);
                            Serial.println("[OFFLINE] CURTAIN -> OFF");
                        }
                    } else if (node_cache[i].light >= local_thresh.thresh_light_high) {
                        if (digitalRead(RELAY_CURTAIN) != RELAY_ON) {
                            digitalWrite(RELAY_CURTAIN, RELAY_ON);
                            Serial.println("[OFFLINE] CURTAIN -> ON");
                        }
                        if (digitalRead(RELAY_LIGHT) != RELAY_OFF) {
                            digitalWrite(RELAY_LIGHT, RELAY_OFF);
                            Serial.println("[OFFLINE] LIGHT -> OFF");
                        }
                    }

                    // HUMIDITY LOGIC (Humidifier) - Hysteresis
                    if (node_cache[i].humid >= local_thresh.thresh_humid_max) {
                        if (digitalRead(RELAY_HUMIDIFIER) != RELAY_OFF) {
                            digitalWrite(RELAY_HUMIDIFIER, RELAY_OFF);
                            Serial.println("[OFFLINE] HUMIDIFIER -> OFF");
                        }
                    } else if (node_cache[i].humid <= local_thresh.thresh_humid_min) {
                        if (digitalRead(RELAY_HUMIDIFIER) != RELAY_ON) {
                            digitalWrite(RELAY_HUMIDIFIER, RELAY_ON);
                            Serial.println("[OFFLINE] HUMIDIFIER -> ON");
                        }
                    }
                }
                xSemaphoreGive(cache_mutex);
            }
        }

        vTaskDelay(2000 / portTICK_PERIOD_MS);
    }
}