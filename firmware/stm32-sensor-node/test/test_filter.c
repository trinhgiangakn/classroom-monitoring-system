/**
 * @file test_filter.c
 * @brief Unit tests for STM32 digital filter algorithms (EMA, Median-3).
 */

#include <stdio.h>
#include <assert.h>
#include <math.h>
#include "../Core/Inc/sensor_types.h"
#include "../Core/Inc/stm_filter.h"

#define EPSILON 0.001f

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
 * @brief Test 1: First sample must initialize EMA without zero-bias delay.
 */
static void test_ema_initialization(void) {
    stm_sensor_data_t data;
    data.temperature_degC = 25.50f;
    data.humidity_RH = 60.00f;
    data.pressure_hPa = 1013.25f;
    data.light_lux = 450.00f;
    data.air_quality_ppm = 120.00f;

    stm_filter_init();
    stm_filter_apply_all(&data);

    TEST_ASSERT(fabsf(data.temperature_degC - 25.50f) < EPSILON, "EMA initialization matches initial temperature");
    TEST_ASSERT(fabsf(data.humidity_RH - 60.00f) < EPSILON, "EMA initialization matches initial humidity");
    TEST_ASSERT(fabsf(data.pressure_hPa - 1013.25f) < EPSILON, "EMA initialization matches initial pressure");
    TEST_ASSERT(fabsf(data.light_lux - 450.00f) < EPSILON, "Median-EMA matches initial lux");
    TEST_ASSERT(fabsf(data.air_quality_ppm - 120.00f) < EPSILON, "Median-EMA matches initial ppm");
}

/**
 * @brief Test 2: Constant input values must produce stable steady-state output.
 */
static void test_ema_steady_state(void) {
    stm_sensor_data_t data;
    stm_filter_init();

    for (int i = 0; i < 10; i++) {
        data.temperature_degC = 28.00f;
        data.humidity_RH = 70.00f;
        data.pressure_hPa = 1010.00f;
        data.light_lux = 300.00f;
        data.air_quality_ppm = 90.00f;
        stm_filter_apply_all(&data);
    }

    TEST_ASSERT(fabsf(data.temperature_degC - 28.00f) < EPSILON, "EMA steady state for temperature is stable at 28.00");
    TEST_ASSERT(fabsf(data.humidity_RH - 70.00f) < EPSILON, "EMA steady state for humidity is stable at 70.00");
    TEST_ASSERT(fabsf(data.pressure_hPa - 1010.00f) < EPSILON, "EMA steady state for pressure is stable at 1010.00");
}

/**
 * @brief Test 3: Median-3 filter must completely reject transient drop (e.g. shadow occlusion).
 */
static void test_median_drop_rejection(void) {
    stm_sensor_data_t data;
    stm_filter_init();

    /* Sample 1: Baseline 500 Lux */
    data.light_lux = 500.0f;
    stm_filter_apply_all(&data);

    /* Sample 2: Baseline 500 Lux */
    data.light_lux = 500.0f;
    stm_filter_apply_all(&data);

    /* Sample 3: Sudden shadow drop to 50 Lux */
    data.light_lux = 50.0f;
    stm_filter_apply_all(&data);

    /* The median of [500, 500, 50] is 500 -> filtered lux must stay around 500, NOT drop to ~50 */
    TEST_ASSERT(data.light_lux >= 490.0f && data.light_lux <= 505.0f, "Median-3 rejects transient shadow drop to 50 Lux");
}

/**
 * @brief Test 4: Median-3 filter must completely reject transient high spike (e.g. relay EMI glitch on gas sensor).
 */
static void test_median_spike_rejection(void) {
    stm_sensor_data_t data;
    stm_filter_init();

    /* Sample 1: Baseline 100 PPM */
    data.air_quality_ppm = 100.0f;
    stm_filter_apply_all(&data);

    /* Sample 2: Baseline 100 PPM */
    data.air_quality_ppm = 100.0f;
    stm_filter_apply_all(&data);

    /* Sample 3: Sudden high electrical spike to 800 PPM */
    data.air_quality_ppm = 800.0f;
    stm_filter_apply_all(&data);

    /* The median of [100, 100, 800] is 100 -> filtered ppm must stay near 100 */
    TEST_ASSERT(data.air_quality_ppm >= 95.0f && data.air_quality_ppm <= 105.0f, "Median-3 rejects transient EMI spike to 800 PPM");
}

void run_filter_tests(int *total_run, int *total_passed) {
    printf("\n=== Running STM32 Digital Filter Tests ===\n");
    test_ema_initialization();
    test_ema_steady_state();
    test_median_drop_rejection();
    test_median_spike_rejection();

    *total_run += tests_run;
    *total_passed += tests_passed;
}
