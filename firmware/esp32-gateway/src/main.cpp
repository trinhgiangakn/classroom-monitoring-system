#include <Arduino.h>
#include "config.h"
#include "shared_data.h"
#include "task_mqtt.h"
#include "task_automation.h"
#include "task_ble.h"

#ifndef PIO_UNIT_TESTING

void setup() {
    Serial.begin(115200);

    // Set relay pins as OUTPUT.
    pinMode(RELAY_FAN, OUTPUT);
    pinMode(RELAY_LIGHT, OUTPUT);
    pinMode(RELAY_CURTAIN, OUTPUT);
    pinMode(RELAY_HUMIDIFIER, OUTPUT);

    // Set all relays to OFF state initially.
    digitalWrite(RELAY_FAN, RELAY_OFF);
    digitalWrite(RELAY_LIGHT, RELAY_OFF);
    digitalWrite(RELAY_CURTAIN, RELAY_OFF);
    digitalWrite(RELAY_HUMIDIFIER, RELAY_OFF);

    // Initialize sensor cache, load configuration from NVS, and set up Wi-Fi and MQTT.
    init_sensor_cache();
    load_config_from_nvs();
    init_wifi_and_mqtt();

    // Create FreeRTOS tasks for MQTT, BLE scanning, automation logic, and gateway health monitoring.
    xTaskCreatePinnedToCore(task_mqtt_unified, "Task_MQTT", 8192, NULL, 2, NULL, 0);

    // Create BLE scanning task, automation task and gateway health monitoring task.
    xTaskCreatePinnedToCore(task_ble_scan, "Task_BLE", 8192, NULL, 2, NULL, 1);
    xTaskCreatePinnedToCore(task_automation, "Task_Auto", 4096, NULL, 1, NULL, 1);
    xTaskCreatePinnedToCore(task_gateway_health, "Task_Health", 4096, NULL, 1, NULL, 1);

    vTaskDelete(NULL);
}

void loop() {}

#endif