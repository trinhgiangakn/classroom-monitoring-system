/**
 * @file stm_aht20_bmp280.h
 * @brief Driver header for AHT20 (Temperature/Humidity) and BMP280 (Pressure/Temperature) sensors.
 * @details Handles I2C communication, sensor trigger commands, raw data retrieval,
 *          and factory trimming / compensation formulas.
 */

#ifndef STM_AHT20_BMP280_H
#define STM_AHT20_BMP280_H

#include "stm32f4xx_hal.h"
#include "sensor_types.h"

/**
 * @brief Reads the factory calibration parameters from BMP280 registers.
 * @details Probes I2C addresses (0x76 and 0x77), loads calibration coefficients
 *          (dig_T1..T3, dig_P1..P9) into the local compensation structure, and enables
 *          normal measurement mode with oversampling.
 * @return STM_OK if calibration constants are successfully loaded; STM_ERROR otherwise.
 */
stm_status_t bmp280_read_calibration(void);

/**
 * @brief Triggers measurements and reads temperature, humidity, and barometric pressure.
 * @details Communicates via I2C to trigger AHT20 conversion, reads raw 6-byte output,
 *          calculates temperature and relative humidity, reads BMP280 uncompensated pressure/temp,
 *          applies compensation formulas, and stores values into the global sensor structure.
 * @return STM_OK on successful read and compensation; STM_ERROR on bus failure.
 */
stm_status_t stm_aht20_bmp280_read_data(void);

#endif /* STM_AHT20_BMP280_H */

