#pragma once
#include <Arduino.h>
#include <Preferences.h>
#include <PubSubClient.h>

// Data structure to hold sensor readings and metadata for each BLE node.
struct node_data_t {
    float temp, humid, light, air_quality, pressure;    
    uint32_t last_update; 
    bool is_online;
};

// Threshold configuration structure for automation logic.
struct threshold_config_t {
    float thresh_temp_max, thresh_temp_min, thresh_humid_max, thresh_humid_min, thresh_light_high, thresh_light_low;   
};

// Global variables for sensor cache, mutexes, and configuration.
extern node_data_t node_cache[4];
extern SemaphoreHandle_t cache_mutex;
extern Preferences nvs;

// Global variables for system configuration and state.
extern threshold_config_t system_thresh;
extern bool is_auto_mode;
extern SemaphoreHandle_t config_mutex;

// Global variable to track MQTT connection status.
extern volatile bool is_mqtt_connected; 

// Function declarations for initializing the sensor cache and updating node data.
void init_sensor_cache();
bool update_node_data(int node_index, float t, float h, float l, float a, float p);