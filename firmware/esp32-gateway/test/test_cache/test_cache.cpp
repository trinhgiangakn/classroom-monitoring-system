#include <Arduino.h>
#include <unity.h>
#include "shared_data.h"
#include "config.h"

void setUp(void) {
    init_sensor_cache();
}

void tearDown(void) {}

void test_feature_cache(void) {
    bool res = update_node_data(0, 25.5, 60.0, 300.0, 50.0, 1013.25);
    TEST_ASSERT_TRUE(res);
    TEST_ASSERT_EQUAL_FLOAT(25.5, node_cache[0].temp);
    TEST_ASSERT_TRUE(node_cache[0].is_online);
}

void setup() {
    delay(2000);
    UNITY_BEGIN();
    RUN_TEST(test_feature_cache);
    UNITY_END();
}

void loop() {}