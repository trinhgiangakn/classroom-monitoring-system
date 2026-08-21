/**
 * @file stm_sensor_manager.c
 * @brief Implementation of high-level sensor initialization and status coordination.
 */

#include "stm_sensor_manager.h"
#include "stm_aht20_bmp280.h"
#include "stm_bh1750.h"

/**
 * @brief Initializes and validates all onboard environmental sensors.
 * @details Reads trimming parameters for BMP280 and puts BH1750 into continuous high-resolution mode.
 * @return stm_status_t STM_OK if all sensor inits pass, STM_ERROR if any sensor fails.
 */
stm_status_t stm_sensors_init(void) {
    stm_status_t status = STM_OK;

    /* Step 1: Read BMP280 calibration coefficients and configure measurement register */
    if (bmp280_read_calibration() != STM_OK) {
        g_stm_error_code |= STM_ERR_AHT20_BMP280;
        status = STM_ERROR;
    }

    /* Step 2: Initialize BH1750 ambient light sensor */
    if (stm_bh1750_init() != STM_OK) {
        g_stm_error_code |= STM_ERR_BH1750;
        status = STM_ERROR;
    }

    return status;
}

