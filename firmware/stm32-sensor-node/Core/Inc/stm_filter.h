/**
 * @file stm_filter.h
 * @brief Digital filtering pipeline for STM32 environmental sensor node.
 * @details Implements EMA (Exponential Moving Average) and Median-3 hybrid filters
 *          to eliminate transient outliers, ADC spikes, and micro-jitter before telemetry transmission.
 */

#ifndef STM_FILTER_H
#define STM_FILTER_H

#include "sensor_types.h"
#include <stdint.h>

/**
 * @brief State container for a single sensor filtering channel.
 */
typedef struct {
    float prev_ema;          /**< Previous EMA filtered output value */
    float median_buf[3];     /**< 3-sample sliding window buffer for Median filter */
    uint8_t is_initialized;  /**< Initialization flag (1 if loaded, 0 otherwise) */
} sensor_filter_channel_t;

/**
 * @brief Resets and initializes all channel filter states.
 */
void stm_filter_init(void);

/**
 * @brief Applies digital filtering across all 5 environmental sensor data fields.
 * @details
 * - Temperature (°C), Humidity (%RH): EMA filter (alpha = 0.20)
 * - Pressure (hPa): EMA filter (alpha = 0.15)
 * - Ambient Light (Lux), Air Quality (PPM): Median-3 filter followed by EMA (alpha = 0.30)
 *
 * @param[in,out] data Pointer to aggregate sensor telemetry data structure.
 */
void stm_filter_apply_all(stm_sensor_data_t *data);

#endif /* STM_FILTER_H */
