#include <Arduino.h>
#include <FreeRTOS.h>
#include <WiFi.h>
#include "shared_data.h"
#include "config.h"

// Task to handle automation logic based on sensor data and thresholds.
void task_automation(void *pvParameters) {
    for(;;) {
        bool is_connected = (WiFi.status() == WL_CONNECTED) && is_mqtt_connected;
        bool current_auto;
        threshold_config_t local_thresh;
        
        // Acquire the current automation mode and threshold configuration safely using a mutex.
        if (xSemaphoreTake(config_mutex, portMAX_DELAY)) {
            current_auto = is_auto_mode;
            local_thresh = system_thresh;
            xSemaphoreGive(config_mutex);
        }
        
        // If the system is in auto mode or not connected to the network, enforce automation logic.
        if (current_auto || !is_connected) {
            if (xSemaphoreTake(cache_mutex, portMAX_DELAY)) {
                for (int i = 0; i < 4; i++) {
                    if (node_cache[i].is_online) { 
                        if (millis() - node_cache[i].last_update > NODE_TIMEOUT_MS) {
                            node_cache[i].is_online = false; 
                            continue;
                        }
                        // Apply automation logic based on temperature.
                        if (node_cache[i].temp > local_thresh.thresh_temp) {
                            if(digitalRead(RELAY_FAN) != RELAY_ON) digitalWrite(RELAY_FAN, RELAY_ON);
                        } else {
                            if(digitalRead(RELAY_FAN) != RELAY_OFF) digitalWrite(RELAY_FAN, RELAY_OFF);
                        }
                        // Apply automation logic based on light levels.
                        if (node_cache[i].light < local_thresh.thresh_light_low) {
                            if(digitalRead(RELAY_LIGHT) != RELAY_ON) { digitalWrite(RELAY_LIGHT, RELAY_ON); digitalWrite(RELAY_CURTAIN, RELAY_OFF); }
                        } else if (node_cache[i].light > local_thresh.thresh_light_high) {
                            if(digitalRead(RELAY_CURTAIN) != RELAY_ON) { digitalWrite(RELAY_CURTAIN, RELAY_ON); digitalWrite(RELAY_LIGHT, RELAY_OFF); }
                        }
                        // Apply automation logic based on humidity.
                        if (node_cache[i].humid > local_thresh.thresh_humid) {  
                            if(digitalRead(RELAY_HUMIDIFIER) != RELAY_OFF) digitalWrite(RELAY_HUMIDIFIER, RELAY_OFF);
                        } else {
                            if(digitalRead(RELAY_HUMIDIFIER) != RELAY_ON) digitalWrite(RELAY_HUMIDIFIER, RELAY_ON);
                        }
                    }
                }
                xSemaphoreGive(cache_mutex);
            }
        }
        vTaskDelay(2000 / portTICK_PERIOD_MS);
    }
}