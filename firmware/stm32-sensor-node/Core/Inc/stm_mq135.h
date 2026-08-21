/**
 * @file stm_mq135.h
 * @brief Driver header for MQ-135 analog air quality / hazardous gas sensor.
 * @details Reads analog voltage via ADC1, applies multi-sample averaging and ppm conversion.
 */

#ifndef STM_MQ135_H
#define STM_MQ135_H

#include "stm32f4xx_hal.h"
#include "sensor_types.h"

/**
 * @brief Samples ADC1 channel, averages readings, computes ppm, and checks range limits.
 * @details Takes multiple ADC samples, converts 12-bit digital value to voltage (0..3.3V),
 *          maps voltage linearly to air quality PPM (0..1000 ppm), and validates against bounds.
 * @return STM_OK if conversion is valid and within range; STM_ERROR otherwise.
 */
stm_status_t stm_mq135_read_ppm(void);

#endif /* STM_MQ135_H */

