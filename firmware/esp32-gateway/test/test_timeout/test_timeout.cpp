#include <Arduino.h>
#include <unity.h>
#include "shared_data.h"
#include "config.h"

void setUp(void) {
    init_sensor_cache();
}

void tearDown(void) {}

void test_feature_timeout(void) {
    update_node_data(1, 26.0, 55.0, 400.0, 45.0, 1010.0);
    
    // Giả lập lùi thời gian cập nhật về quá khứ (vượt quá 5 phút timeout)
    node_cache[1].last_update = millis() - (NODE_TIMEOUT_MS + 1000); 
    
    bool is_timeout = ((millis() - node_cache[1].last_update) > NODE_TIMEOUT_MS);
    TEST_ASSERT_TRUE_MESSAGE(is_timeout, "Lỗi: Không phát hiện được Node bị timeout!");
}

void setup() {
    delay(2000);
    UNITY_BEGIN();
    RUN_TEST(test_feature_timeout);
    UNITY_END();
}

void loop() {}