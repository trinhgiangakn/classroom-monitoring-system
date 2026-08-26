#include <Arduino.h>
#include <unity.h>
#include "shared_data.h"
#include "config.h"

void setUp(void) {
    init_sensor_cache();
}

void tearDown(void) {}

void test_feature_automation(void) {
    system_thresh.thresh_temp_max = 35.0f; 
    update_node_data(0, 38.0f, 60.0f, 300.0f, 50.0f, 1013.25f); 
    
    bool trigger_fan = (node_cache[0].temp >= system_thresh.thresh_temp_max); 
    TEST_ASSERT_TRUE_MESSAGE(trigger_fan, "Loi: Quat khong duoc kich hoat khi nhiet do vuot nguong!");
}

void setup() {
    delay(2000);
    UNITY_BEGIN();
    RUN_TEST(test_feature_automation);
    UNITY_END();
}

void loop() {}