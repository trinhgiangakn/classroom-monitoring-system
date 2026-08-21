/**
 * @file stm_bh1750.c
 * @brief Implementation of driver for BH1750 ambient light intensity sensor.
 * @details Handles I2C command transmission, measurement delay timing,
 *          and raw optical conversion to Lux.
 */

#include "stm32f4xx_hal.h"
#include "stm_bh1750.h"

extern I2C_HandleTypeDef hi2c1;

/**
 * @brief Transmits a 1-byte command opcode to the BH1750 sensor over I2C.
 * @param[in] cmd Command opcode (e.g. 0x10 for Continuous H-Resolution mode).
 * @return stm_status_t STM_OK on successful transmission, STM_ERROR otherwise.
 */
static stm_status_t stmi_bh1750_write_command(uint8_t cmd) {
    if (HAL_I2C_Master_Transmit(&hi2c1, (0x23 << 1), &cmd, 1, 100) != HAL_OK) {
        return STM_ERROR;
    }
    return STM_OK;
}

/**
 * @brief Reads 2 raw data bytes containing optical measurement from BH1750.
 * @param[out] raw_buf Buffer of 2 bytes to store the high and low byte results.
 * @return stm_status_t STM_OK if read succeeds, STM_ERROR on bus failure.
 */
static stm_status_t stmi_bh1750_read_bytes(uint8_t *raw_buf) {
    if (HAL_I2C_Master_Receive(&hi2c1, (0x23 << 1), raw_buf, 2, 100) != HAL_OK) {
        return STM_ERROR;
    }
    return STM_OK;
}

/**
 * @brief Converts 2 raw data bytes into illuminance value in Lux.
 * @details Formula: Lux = (Raw_High << 8 | Raw_Low) / 1.2
 * @param[in] raw_buf 2-byte array received from BH1750 sensor.
 * @return float Calculated illuminance in Lux.
 */
static float stmi_bh1750_convert_to_lux(const uint8_t *raw_buf) {
    uint16_t lux_raw = (raw_buf[0] << 8) | raw_buf[1];
    return (float)lux_raw / 1.2f;
}

/**
 * @brief Initializes the BH1750 sensor in Continuous H-Resolution mode (0x10).
 * @return stm_status_t STM_OK if initialized successfully, STM_ERROR otherwise.
 */
stm_status_t stm_bh1750_init(void) {
    return stmi_bh1750_write_command(0x10);
}

/**
 * @brief Reads ambient light level and updates global sensor structure.
 * @details Sends Continuous H-Resolution command (0x10), waits for optical integration time (180ms),
 *          reads 2 bytes via I2C, converts to Lux, and stores into `g_stm_sensor_data.light_lux`.
 * @return stm_status_t STM_OK on success, STM_ERROR on failure.
 */
stm_status_t stm_bh1750_read_lux(void) {
    /* Step 1: Send measurement command */
    if (stmi_bh1750_write_command(0x10) != STM_OK) {
        g_stm_error_code = STM_ERR_I2C;
        return STM_ERROR;
    }

    /* Step 2: Wait for measurement completion (integration time: typ. 120ms, max 180ms) */
    HAL_Delay(180);

    /* Step 3: Read 2 bytes of lux result */
    uint8_t raw[2];
    if (stmi_bh1750_read_bytes(raw) != STM_OK) {
        g_stm_error_code = STM_ERR_I2C;
        return STM_ERROR;
    }

    /* Step 4: Convert and record illuminance */
    g_stm_sensor_data.light_lux = stmi_bh1750_convert_to_lux(raw);
    return STM_OK;
}

