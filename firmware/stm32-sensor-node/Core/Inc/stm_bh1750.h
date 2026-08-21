/**
 * @file stm_bh1750.h
 * @brief Driver header for BH1750 ambient light intensity sensor.
 * @details Manages I2C communication and illuminance measurements (Lux).
 */

#ifndef STM_BH1750_H
#define STM_BH1750_H

#include "stm32f4xx_hal.h"
#include "sensor_types.h"

/**
 * @brief Initializes the BH1750 sensor in Continuous High-Resolution mode.
 * @return STM_OK if initialization command was acknowledged; STM_ERROR otherwise.
 */
stm_status_t stm_bh1750_init(void);

/**
 * @brief Triggers measurement, waits for optical integration time, and reads light intensity in Lux.
 * @details Sends 0x10 command, waits for conversion (180ms max), reads 2 data bytes,
 *          divides by optical scaling factor 1.2, and updates `g_stm_sensor_data.light_lux`.
 * @return STM_OK on successful read; STM_ERROR on bus failure.
 */
stm_status_t stm_bh1750_read_lux(void);

#endif /* STM_BH1750_H */

