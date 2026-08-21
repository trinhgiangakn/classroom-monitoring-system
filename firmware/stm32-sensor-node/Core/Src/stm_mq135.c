/**
 * @file stm_mq135.c
 * @brief Implementation of driver for MQ-135 analog air quality sensor.
 * @details Performs software-triggered ADC polling, multi-sample averaging,
 *          voltage calculation, and linear PPM scaling with sanity checks.
 */

#include "stm32f4xx_hal.h"
#include "stm_mq135.h"

extern ADC_HandleTypeDef hadc1;

/** @brief Number of consecutive ADC samples gathered for low-pass filtering / averaging. */
const uint8_t g_stm_adc_samples_count = 10;

/**
 * @brief Triggers a single ADC conversion on ADC1 channel 0 and reads the raw 12-bit result.
 * @return uint32_t Raw 12-bit ADC reading (0..4095), or 0 if conversion timed out.
 */
static uint32_t stmi_mq135_read_adc_raw(void) {
    HAL_ADC_Start(&hadc1);
    if (HAL_ADC_PollForConversion(&hadc1, 10) == HAL_OK) {
        return HAL_ADC_GetValue(&hadc1);
    }
    return 0;
}

/**
 * @brief Converts 12-bit average ADC code to analog voltage in Volts.
 * @details Formula: Voltage (V) = (avg_adc / 4095) * 3.3V
 * @param[in] avg_adc Average raw ADC reading (0..4095).
 * @return float Equivalent analog voltage (0.0V .. 3.3V).
 */
static float stmi_mq135_calc_voltage(float avg_adc) {
    return (avg_adc / 4095.0f) * 3.3f;
}

/**
 * @brief Maps measured analog voltage to air quality PPM estimate.
 * @details Formula: PPM = Voltage (V) * 200.0 (Linearized transfer function)
 * @param[in] voltage Analog voltage in Volts (0.0V .. 3.3V).
 * @return float Estimated gas concentration in parts-per-million (PPM).
 */
static float stmi_mq135_calc_ppm(float voltage) {
    return voltage * 200.0f;
}

/**
 * @brief Samples MQ-135 sensor, averages readings, validates range, and stores result.
 * @details Steps:
 *          1. Accumulate N consecutive raw ADC samples.
 *          2. Compute arithmetic average.
 *          3. Convert average ADC count to analog voltage.
 *          4. Compute gas concentration (PPM).
 *          5. Validate value against bounds [0.0 .. 1000.0 ppm].
 * @return stm_status_t STM_OK if reading is valid, STM_ERROR if out of range or ADC fails.
 */
stm_status_t stm_mq135_read_ppm(void) {
    uint32_t sum_adc_value = 0;

    /* Step 1: Accumulate samples */
    for (uint8_t index = 0; index < g_stm_adc_samples_count; index++) {
        sum_adc_value += stmi_mq135_read_adc_raw();
    }

    /* Step 2-4: Calculate average, voltage, and PPM */
    float avg_adc = (float)sum_adc_value / g_stm_adc_samples_count;
    float voltage = stmi_mq135_calc_voltage(avg_adc);
    float ppm = stmi_mq135_calc_ppm(voltage);

    /* Step 5: Check out-of-range bounds */
    if (ppm < 0.0f || ppm > 1000.0f) {
        g_stm_error_code = STM_ERR_ADC;
        return STM_ERROR;
    }

    g_stm_sensor_data.air_quality_ppm = ppm;
    return STM_OK;
}

