/**
 * @file stm_sensor_manager.h
 * @brief High-level sensor manager interface for STM32 sensor node.
 * @details Coordinates initialization and health checking across all connected sensor drivers.
 */

#ifndef STM_SENSOR_MANAGER_H
#define STM_SENSOR_MANAGER_H

#include "sensor_types.h"

/**
 * @brief Initializes all onboard environmental sensors.
 * @details Performs initialization sequences and reads factory calibration constants
 *          for BMP280 and BH1750 sensors. Updates global error bitmask if any sensor fails.
 * @return STM_OK if all sensors initialized successfully, STM_ERROR if any sensor failed.
 */
stm_status_t stm_sensors_init(void);

#endif /* STM_SENSOR_MANAGER_H */

