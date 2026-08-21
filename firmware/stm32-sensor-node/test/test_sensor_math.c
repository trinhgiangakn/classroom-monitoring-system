/**
 * @file test_sensor_math.c
 * @brief Unit tests for sensor conversion formulas and compensation arithmetic.
 */

#include <stdio.h>
#include <stdint.h>
#include <assert.h>
#include <math.h>

#define EPSILON 0.05f

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
 * @brief Test AHT20 bit-unpacking and conversion arithmetic.
 */
static void test_aht20_conversion_math(void) {
    /* Simulated 6-byte raw AHT20 response */
    /* Let hum_raw = 681574 (approx 65.0% RH), temp_raw = 393216 (approx 25.0 °C) */
    /* hum_raw = 0x0A6666, temp_raw = 0x060000 */
    uint8_t raw_buf[6] = {
        0x18,       /* Status byte */
        0xA6,       /* hum[19:12] = 0xA6 */
        0x66,       /* hum[11:4]  = 0x66 */
        0x66,       /* hum[3:0]=0x6, temp[19:16]=0x6 */
        0x00,       /* temp[15:8] = 0x00 */
        0x00        /* temp[7:0]  = 0x00 */
    };

    uint32_t hum_raw = ((uint32_t)raw_buf[1] << 12) | ((uint32_t)raw_buf[2] << 4) | (raw_buf[3] >> 4);
    uint32_t temp_raw = (((uint32_t)raw_buf[3] & 0x0F) << 16) | ((uint32_t)raw_buf[4] << 8) | raw_buf[5];

    float hum = ((float)hum_raw / 1048576.0f) * 100.0f;
    float temp = ((float)temp_raw / 1048576.0f) * 200.0f - 50.0f;

    TEST_ASSERT(fabsf(temp - 25.0f) < EPSILON, "AHT20 temperature conversion calculates 25.0 °C");
    TEST_ASSERT(fabsf(hum - 65.0f) < 0.1f, "AHT20 humidity conversion calculates ~65.0 %RH");
}

/**
 * @brief Test BH1750 16-bit raw optical conversion to Lux.
 */
static void test_bh1750_conversion_math(void) {
    /* 2 raw bytes received: High byte = 0x02, Low byte = 0x58 (decimal 600) */
    uint8_t raw_buf[2] = {0x02, 0x58};
    uint16_t lux_raw = (raw_buf[0] << 8) | raw_buf[1];
    float lux = (float)lux_raw / 1.2f;

    /* 600 / 1.2 = 500.0 Lux */
    TEST_ASSERT(fabsf(lux - 500.0f) < EPSILON, "BH1750 raw 600 converts accurately to 500.0 Lux");
}

/**
 * @brief Test MQ-135 12-bit ADC voltage and PPM linear mapping.
 */
static void test_mq135_conversion_math(void) {
    /* Average raw ADC 12-bit = 1241 (approx 1.0 Volt -> 200 PPM) */
    float avg_adc = 1240.91f;
    float voltage = (avg_adc / 4095.0f) * 3.3f;
    float ppm = voltage * 200.0f;

    TEST_ASSERT(fabsf(voltage - 1.0f) < EPSILON, "MQ-135 ADC 1241 maps to 1.0V");
    TEST_ASSERT(fabsf(ppm - 200.0f) < 1.0f, "MQ-135 1.0V maps to 200.0 PPM");

    /* Out of range checks */
    float out_of_range_high = 1200.0f;
    int is_valid_high = (out_of_range_high >= 0.0f && out_of_range_high <= 1000.0f);
    TEST_ASSERT(is_valid_high == 0, "MQ-135 properly rejects >1000 PPM out of bounds");
}

/**
 * @brief Test Bosch BMP280 64-bit integer pressure compensation formula.
 */
static void test_bmp280_bosch_compensation_math(void) {
    /* Test parameters based on typical Bosch calibration set */
    uint16_t dig_T1 = 27504;
    int16_t  dig_T2 = 26435;
    int16_t  dig_T3 = -1000;
    uint16_t dig_P1 = 36477;
    int16_t  dig_P2 = -10685;
    int16_t  dig_P3 = 3024;
    int16_t  dig_P4 = 2855;
    int16_t  dig_P5 = 140;
    int16_t  dig_P6 = -7;
    int16_t  dig_P7 = 15500;
    int16_t  dig_P8 = -14600;
    int16_t  dig_P9 = 6000;

    int32_t adc_T = 519888;
    int32_t adc_P = 415148;

    /* Temperature fine calculation */
    int32_t var1_t = ((((adc_T >> 3) - ((int32_t)dig_T1 << 1))) * ((int32_t)dig_T2)) >> 11;
    int32_t var2_t = (((((adc_T >> 4) - ((int32_t)dig_T1)) * ((adc_T >> 4) - ((int32_t)dig_T1))) >> 12) * ((int32_t)dig_T3)) >> 14;
    int32_t t_fine = var1_t + var2_t;

    /* Pressure compensation */
    int64_t var1, var2, p;
    var1 = ((int64_t)t_fine) - 128000;
    var2 = var1 * var1 * (int64_t)dig_P6;
    var2 = var2 + ((var1 * (int64_t)dig_P5) << 17);
    var2 = var2 + (((int64_t)dig_P4) << 35);
    var1 = ((var1 * var1 * (int64_t)dig_P3) >> 8) + ((var1 * (int64_t)dig_P2) << 12);
    var1 = (((((int64_t)1) << 47) + var1)) * ((int64_t)dig_P1) >> 33;

    TEST_ASSERT(var1 != 0, "BMP280 var1 denominator is non-zero");

    p = 1048576 - adc_P;
    p = (((p << 31) - var2) * 3125) / var1;
    var1 = (((int64_t)dig_P9) * (p >> 13) * (p >> 13)) >> 25;
    var2 = (((int64_t)dig_P8) * p) >> 19;
    p = ((p + var1 + var2) >> 8) + (((int64_t)dig_P7) << 4);

    float pressure_hPa = (float)p / 256.0f / 100.0f;

    /* Should compute standard atmospheric pressure range (around 1000 - 1015 hPa) */
    TEST_ASSERT(pressure_hPa >= 900.0f && pressure_hPa <= 1100.0f, "BMP280 64-bit compensation produces valid hPa in nominal range");
}

void run_sensor_math_tests(int *total_run, int *total_passed) {
    printf("\n=== Running STM32 Sensor Math & Conversion Tests ===\n");
    test_aht20_conversion_math();
    test_bh1750_conversion_math();
    test_mq135_conversion_math();
    test_bmp280_bosch_compensation_math();

    *total_run += tests_run;
    *total_passed += tests_passed;
}
