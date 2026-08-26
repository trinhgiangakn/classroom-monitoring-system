#include <Arduino.h>
#include <unity.h>
#include "shared_data.h"
#include "config.h"

void setUp(void) {
    init_sensor_cache();
}

void tearDown(void) {}

void test_feature_cache(void) {
    bool res = update_node_data(0, 25.5f, 60.0f, 300.0f, 50.0f, 1013.25f);
    TEST_ASSERT_TRUE(res);
    
    TEST_ASSERT_TRUE(node_cache[0].temp > 25.4f && node_cache[0].temp < 25.6f); 
    TEST_ASSERT_TRUE(node_cache[0].is_online);
}

void setup() {
    delay(2000);
    UNITY_BEGIN();
    RUN_TEST(test_feature_cache);
    UNITY_END();
}

void loop() {}