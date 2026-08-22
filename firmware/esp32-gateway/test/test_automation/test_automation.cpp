#include <Arduino.h>
#include <unity.h>
#include "shared_data.h"
#include "config.h"

void setUp(void) {
    init_sensor_cache(); // Khởi tạo lại cache trước khi test
}

void tearDown(void) {}

void test_feature_automation(void) {
    system_thresh.thresh_temp = 35.0; // Giả lập ngưỡng hệ thống
    update_node_data(0, 38.0, 60.0, 300.0, 50.0, 1013.25); // Cập nhật dữ liệu vượt ngưỡng
    
    bool trigger_fan = (node_cache[0].temp > system_thresh.thresh_temp);
    TEST_ASSERT_TRUE_MESSAGE(trigger_fan, "Lỗi: Quạt không được kích hoạt khi nhiệt độ vượt ngưỡng!");
}

void setup() {
    delay(2000);
    UNITY_BEGIN();
    RUN_TEST(test_feature_automation);
    UNITY_END();
}

void loop() {}