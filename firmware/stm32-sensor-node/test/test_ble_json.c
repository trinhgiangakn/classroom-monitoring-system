/**
 * @file test_ble_json.c
 * @brief Unit tests for JSON string serialization and error bitmask management.
 */

#include <stdio.h>
#include <stdint.h>
#include <string.h>
#include <assert.h>
#include "../Core/Inc/sensor_types.h"

static int tests_run = 0;
static int tests_passed = 0;

#define TEST_ASSERT(condition, msg) do { \
    tests_run++; \
    if (condition) { \
        tests_passed++; \
        printf("  [PASS] %s\n", msg); \
    } else { \
        printf("  [FAIL] %s (Line %d)\n", msg, __LINE__); \
    } \
} while (0)

/**
 * @brief Test JSON string serialization for nominal values.
 */
static void test_json_nominal_serialization(void) {
    char data_buffer[128];
    int node_id = 4;
    float temp = 26.50f;
    float hum = 62.35f;
    float press = 1012.80f;
    float lux = 380.20f;
    float ppm = 115.65f;

    int t_int = (int)temp;
    float t_diff = (temp - (float)t_int) * 100.0f;
    int t_dec = (int)(t_diff >= 0.0f ? (t_diff + 0.5f) : (-t_diff + 0.5f));
    if (t_dec >= 100) { t_dec = 99; }

    int h_int = (int)hum;
    float h_diff = (hum - (float)h_int) * 100.0f;
    int h_dec = (int)(h_diff >= 0.0f ? (h_diff + 0.5f) : (-h_diff + 0.5f));
    if (h_dec >= 100) { h_dec = 99; }

    int p_int = (int)press;
    float p_diff = (press - (float)p_int) * 100.0f;
    int p_dec = (int)(p_diff >= 0.0f ? (p_diff + 0.5f) : (-p_diff + 0.5f));
    if (p_dec >= 100) { p_dec = 99; }

    int l_int = (int)lux;
    float l_diff = (lux - (float)l_int) * 100.0f;
    int l_dec = (int)(l_diff >= 0.0f ? (l_diff + 0.5f) : (-l_diff + 0.5f));
    if (l_dec >= 100) { l_dec = 99; }

    int q_int = (int)ppm;
    float q_diff = (ppm - (float)q_int) * 100.0f;
    int q_dec = (int)(q_diff >= 0.0f ? (q_diff + 0.5f) : (-q_diff + 0.5f));
    if (q_dec >= 100) { q_dec = 99; }

    snprintf(data_buffer, sizeof(data_buffer),
             "{\"node\":%d,\"temp\":%d.%02d,\"hum\":%d.%02d,\"press\":%d.%02d,\"lux\":%d.%02d,\"ppm\":%d.%02d}\r\n",
             node_id,
             t_int, t_dec,
             h_int, h_dec,
             p_int, p_dec,
             l_int, l_dec,
             q_int, q_dec);

    const char *expected = "{\"node\":4,\"temp\":26.50,\"hum\":62.35,\"press\":1012.80,\"lux\":380.20,\"ppm\":115.65}\r\n";
    TEST_ASSERT(strcmp(data_buffer, expected) == 0, "JSON payload serialized correctly for nominal values");
}

/**
 * @brief Test JSON string serialization for negative temperatures and zero-padded decimals.
 */
static void test_json_subzero_and_padding(void) {
    char data_buffer[128];
    int node_id = 2;
    float temp = -5.05f;  /* Negative with leading zero in decimal part */
    float hum = 50.08f;   /* Leading zero in decimal part */
    float press = 998.02f;
    float lux = 0.00f;
    float ppm = 45.00f;

    int t_int = (int)temp;
    float t_diff = (temp - (float)t_int) * 100.0f;
    int t_dec = (int)(t_diff >= 0.0f ? (t_diff + 0.5f) : (-t_diff + 0.5f));
    if (t_dec >= 100) { t_dec = 99; }

    int h_int = (int)hum;
    float h_diff = (hum - (float)h_int) * 100.0f;
    int h_dec = (int)(h_diff >= 0.0f ? (h_diff + 0.5f) : (-h_diff + 0.5f));
    if (h_dec >= 100) { h_dec = 99; }

    int p_int = (int)press;
    float p_diff = (press - (float)p_int) * 100.0f;
    int p_dec = (int)(p_diff >= 0.0f ? (p_diff + 0.5f) : (-p_diff + 0.5f));
    if (p_dec >= 100) { p_dec = 99; }

    int l_int = (int)lux;
    float l_diff = (lux - (float)l_int) * 100.0f;
    int l_dec = (int)(l_diff >= 0.0f ? (l_diff + 0.5f) : (-l_diff + 0.5f));
    if (l_dec >= 100) { l_dec = 99; }

    int q_int = (int)ppm;
    float q_diff = (ppm - (float)q_int) * 100.0f;
    int q_dec = (int)(q_diff >= 0.0f ? (q_diff + 0.5f) : (-q_diff + 0.5f));
    if (q_dec >= 100) { q_dec = 99; }

    snprintf(data_buffer, sizeof(data_buffer),
             "{\"node\":%d,\"temp\":%d.%02d,\"hum\":%d.%02d,\"press\":%d.%02d,\"lux\":%d.%02d,\"ppm\":%d.%02d}\r\n",
             node_id,
             t_int, t_dec,
             h_int, h_dec,
             p_int, p_dec,
             l_int, l_dec,
             q_int, q_dec);

    /* Should not produce "-5.-05" or "-5.5" */
    const char *expected = "{\"node\":2,\"temp\":-5.05,\"hum\":50.08,\"press\":998.02,\"lux\":0.00,\"ppm\":45.00}\r\n";
    TEST_ASSERT(strcmp(data_buffer, expected) == 0, "JSON payload correctly formats negative temp '-5.05' and '.08' padding");
}

/**
 * @brief Test Bitmask error flag operations.
 */
static void test_error_bitmask_operations(void) {
    uint32_t error_code = STM_ERR_NONE;

    /* Set I2C error */
    error_code |= STM_ERR_I2C;
    TEST_ASSERT((error_code & STM_ERR_I2C) != 0, "Bitmask captures STM_ERR_I2C");
    TEST_ASSERT((error_code & STM_ERR_UART) == 0, "Bitmask isolates STM_ERR_UART");

    /* Accumulate BH1750 error */
    error_code |= STM_ERR_BH1750;
    TEST_ASSERT((error_code & STM_ERR_I2C) != 0, "Bitmask preserves previous STM_ERR_I2C");
    TEST_ASSERT((error_code & STM_ERR_BH1750) != 0, "Bitmask captures accumulated STM_ERR_BH1750");

    /* Clear I2C error */
    error_code &= ~STM_ERR_I2C;
    TEST_ASSERT((error_code & STM_ERR_I2C) == 0, "Bitmask clears STM_ERR_I2C successfully");
    TEST_ASSERT((error_code & STM_ERR_BH1750) != 0, "Bitmask retains active STM_ERR_BH1750");
}

void run_ble_json_tests(int *total_run, int *total_passed) {
    printf("\n=== Running STM32 JSON Serialization & Error Bitmask Tests ===\n");
    test_json_nominal_serialization();
    test_json_subzero_and_padding();
    test_error_bitmask_operations();

    *total_run += tests_run;
    *total_passed += tests_passed;
}
