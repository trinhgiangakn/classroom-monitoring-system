/**
 * @file stm_filter.c
 * @brief Implementation of lightweight digital filters for STM32 sensor node.
 * @details Realizes EMA (Exponential Moving Average) and Median-3 hybrid filters
 *          to eliminate transient outliers, ADC spikes, and micro-jitter before telemetry transmission.
 */

#include "stm_filter.h"

/** @brief Filtering channel state for Ambient Temperature */
static sensor_filter_channel_t filter_temp;

/** @brief Filtering channel state for Relative Humidity */
static sensor_filter_channel_t filter_hum;

/** @brief Filtering channel state for Atmospheric Pressure */
static sensor_filter_channel_t filter_press;

/** @brief Filtering channel state for Ambient Light Intensity */
static sensor_filter_channel_t filter_lux;

/** @brief Filtering channel state for Air Quality / Gas Concentration */
static sensor_filter_channel_t filter_ppm;

/**
 * @brief Applies Exponential Moving Average (EMA / Low-pass IIR) filter.
 * @param[in,out] f       Pointer to sensor channel filter state.
 * @param[in]     new_val Latest raw sensor measurement.
 * @param[in]     alpha   Smoothing factor (0.0 < alpha <= 1.0).
 * @return float Filtered output value.
 */
static float filter_ema(sensor_filter_channel_t *f, float new_val, float alpha) {
    if (!f->is_initialized) {
        f->prev_ema = new_val;
        f->is_initialized = 1;
        return new_val;
    }
    f->prev_ema = (alpha * new_val) + ((1.0f - alpha) * f->prev_ema);
    return f->prev_ema;
}

/**
 * @brief Applies 3-sample Median filter followed by EMA smoothing.
 * @details Removes impulse spikes / shadow occlusions before smoothing.
 * @param[in,out] f       Pointer to sensor channel filter state.
 * @param[in]     new_val Latest raw sensor measurement.
 * @param[in]     alpha   Smoothing factor for post-median EMA stage.
 * @return float Filtered output value.
 */
static float filter_median_ema(sensor_filter_channel_t *f, float new_val, float alpha) {
    if (!f->is_initialized) {
        f->median_buf[0] = new_val;
        f->median_buf[1] = new_val;
        f->median_buf[2] = new_val;
        f->prev_ema = new_val;
        f->is_initialized = 1;
        return new_val;
    }

    /* 1. Shift sliding window */
    f->median_buf[0] = f->median_buf[1];
    f->median_buf[1] = f->median_buf[2];
    f->median_buf[2] = new_val;

    /* 2. Determine median of 3 elements */
    float a = f->median_buf[0], b = f->median_buf[1], c = f->median_buf[2];
    float median = ((a <= b && b <= c) || (c <= b && b <= a)) ? b :
                   ((b <= a && a <= c) || (c <= a && a <= b)) ? a : c;

    /* 3. Smooth median value with EMA */
    f->prev_ema = (alpha * median) + ((1.0f - alpha) * f->prev_ema);
    return f->prev_ema;
}

/**
 * @brief Initializes all filter channels.
 */
void stm_filter_init(void) {
    filter_temp.is_initialized = 0;
    filter_hum.is_initialized = 0;
    filter_press.is_initialized = 0;
    filter_lux.is_initialized = 0;
    filter_ppm.is_initialized = 0;
}

/**
 * @brief Filters all 5 sensor fields in-place.
 */
void stm_filter_apply_all(stm_sensor_data_t *data) {
    if (data == 0) return;

    /* Group 1: Continuous parameters -> EMA filter */
    data->temperature_degC = filter_ema(&filter_temp, data->temperature_degC, 0.20f);
    data->humidity_RH       = filter_ema(&filter_hum, data->humidity_RH, 0.20f);
    data->pressure_hPa      = filter_ema(&filter_press, data->pressure_hPa, 0.15f);

    /* Group 2: Spike-prone optical & analog gas channels -> Median-3 + EMA */
    data->light_lux         = filter_median_ema(&filter_lux, data->light_lux, 0.30f);
    data->air_quality_ppm   = filter_median_ema(&filter_ppm, data->air_quality_ppm, 0.30f);
}
