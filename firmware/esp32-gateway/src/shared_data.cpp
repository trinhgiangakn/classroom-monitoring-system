#include "shared_data.h"

// Global variables for sensor cache, mutexes, and configuration.
node_data_t node_cache[4];
SemaphoreHandle_t cache_mutex;
SemaphoreHandle_t config_mutex;
Preferences nvs;

// Global variables for system configuration and state.
volatile bool is_mqtt_connected = false;
threshold_config_t system_thresh = {35.0, 80.0, 200.0, 800.0, 1000.0, 1000.0};
bool is_auto_mode = true;

// Function to initialize the sensor cache and mutexes.
void init_sensor_cache() {
    cache_mutex = xSemaphoreCreateMutex();
    config_mutex = xSemaphoreCreateMutex();

    for(int i = 0; i < 4; i++) {
        node_cache[i].last_update = 0;
        node_cache[i].is_online = false;
    }
}

// Function to update sensor data for a specific node in the cache.
bool update_node_data(int node_index, float t, float h, float l, float a, float p) {
    if(node_index < 0 || node_index > 3) return false;
    if(xSemaphoreTake(cache_mutex, portMAX_DELAY)) {
        node_cache[node_index] = {t, h, l, a, p, millis(), true};
        xSemaphoreGive(cache_mutex);
        return true;
    }
    return false;
}