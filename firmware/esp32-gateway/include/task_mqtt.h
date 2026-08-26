#pragma once
#include <Arduino.h>
#include <freertos/FreeRTOS.h>
#include <freertos/queue.h>

// Data structure for MQTT messages to be sent.
typedef struct {
    char topic[64];
    char payload[256];
} mqtt_msg_t;

// Global variables for queue, and current configuration.
extern QueueHandle_t mqtt_queue;
extern const String NODE_IDS[4]; 

// Function declarations for MQTT and Wi-Fi tasks.
void load_config_from_nvs();
void init_wifi_and_mqtt();
void task_mqtt_unified(void *pvParameters);
void task_gateway_health(void *pvParameters);