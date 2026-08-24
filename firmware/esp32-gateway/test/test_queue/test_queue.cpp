#include <Arduino.h>
#include <unity.h>
#include "shared_data.h"
#include "config.h"
#include "task_mqtt.h" 

void setUp(void) {
    if (mqtt_queue != NULL) {
        xQueueReset(mqtt_queue);
    } else {
        mqtt_queue = xQueueCreate(15, sizeof(mqtt_msg_t));
    }
}

void tearDown(void) {}

void test_feature_queue(void) {
    mqtt_msg_t msg;
    for(int i = 0; i < 15; i++) {
        xQueueSend(mqtt_queue, &msg, 0); 
    }
    
    if (xQueueSend(mqtt_queue, &msg, 0) != pdPASS) {
        mqtt_msg_t dummy;
        xQueueReceive(mqtt_queue, &dummy, 0); 
        BaseType_t res = xQueueSend(mqtt_queue, &msg, 0);
        TEST_ASSERT_EQUAL_MESSAGE(pdPASS, res, "Lỗi: Không thể ghi đè vào Ring Buffer!");
    } else {
        TEST_FAIL_MESSAGE("Lỗi: Hàng đợi chưa thực sự đầy (cấu hình sai kích thước)!");
    }
}

void setup() {
    delay(2000);
    UNITY_BEGIN();
    RUN_TEST(test_feature_queue);
    UNITY_END();
}

void loop() {}