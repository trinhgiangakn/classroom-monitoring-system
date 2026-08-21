/**
 * @file stm_aht20_bmp280.c
 * @brief Implementation of driver for AHT20 (Temp/Hum) and BMP280 (Pressure) sensors.
 * @details Implements I2C transactions, sensor-specific measurement triggers,
 *          bit unpacking, and Bosch 64-bit pressure compensation arithmetic.
 */

#include "stm32f4xx_hal.h"
#include "stm_aht20_bmp280.h"

extern I2C_HandleTypeDef hi2c1;

/**
 * @brief Calibration parameters structure for BMP280 trimming registers.
 * @details Trimming parameters stored in NVM (Non-Volatile Memory) read from 0x88..0x9F.
 */
typedef struct {
    uint16_t dig_T1; /**< Temperature compensation coefficient T1 (unsigned 16-bit) */
    int16_t  dig_T2; /**< Temperature compensation coefficient T2 (signed 16-bit) */
    int16_t  dig_T3; /**< Temperature compensation coefficient T3 (signed 16-bit) */
    uint16_t dig_P1; /**< Pressure compensation coefficient P1 (unsigned 16-bit) */
    int16_t  dig_P2; /**< Pressure compensation coefficient P2 (signed 16-bit) */
    int16_t  dig_P3; /**< Pressure compensation coefficient P3 (signed 16-bit) */
    int16_t  dig_P4; /**< Pressure compensation coefficient P4 (signed 16-bit) */
    int16_t  dig_P5; /**< Pressure compensation coefficient P5 (signed 16-bit) */
    int16_t  dig_P6; /**< Pressure compensation coefficient P6 (signed 16-bit) */
    int16_t  dig_P7; /**< Pressure compensation coefficient P7 (signed 16-bit) */
    int16_t  dig_P8; /**< Pressure compensation coefficient P8 (signed 16-bit) */
    int16_t  dig_P9; /**< Pressure compensation coefficient P9 (signed 16-bit) */
} bmp280_calib_t;

/** @brief Active BMP280 calibration coefficient set. */
static bmp280_calib_t calib;

/** @brief Active 8-bit shifted I2C address for BMP280 (0xEC for 0x76, or 0xEE for 0x77). */
static uint8_t bmp280_addr = 0;

/** @brief Flag indicating whether BMP280 calibration constants have been loaded. */
static uint8_t is_calibrated = 0;

/** @brief Fine temperature resolution value used during pressure compensation. */
static int32_t t_fine = 0;

/**
 * @brief Sends measurement trigger command to AHT20 and reads 6-byte raw response.
 * @param[out] raw_buf Buffer of at least 6 bytes to store raw sensor response.
 * @return stm_status_t STM_OK on successful I2C transfer, STM_ERROR on timeout or NACK.
 */
static stm_status_t stmi_aht20_read_raw_bytes(uint8_t *raw_buf) {
    uint8_t trigger_cmd[3] = {0xAC, 0x33, 0x00};
    if (HAL_I2C_Master_Transmit(&hi2c1, (0x38 << 1), trigger_cmd, 3, 100) != HAL_OK) {
        return STM_ERROR;
    }
    HAL_Delay(80);
    if (HAL_I2C_Master_Receive(&hi2c1, (0x38 << 1), raw_buf, 6, 100) != HAL_OK) {
        return STM_ERROR;
    }
    return STM_OK;
}

/**
 * @brief Converts AHT20 6-byte raw output to temperature and relative humidity.
 * @details Humidity: 20-bit raw data across bytes 1, 2, and high nibble of byte 3.
 *          Formula: RH(%) = (hum_raw / 2^20) * 100
 *          Temperature: 20-bit raw data across low nibble of byte 3, byte 4, and byte 5.
 *          Formula: T(°C) = (temp_raw / 2^20) * 200 - 50
 * @param[in]  raw_buf 6-byte array containing AHT20 measurement data.
 * @param[out] temp    Pointer to float to store computed temperature (°C).
 * @param[out] hum     Pointer to float to store computed relative humidity (%RH).
 */
static void stmi_aht20_calc_temp_hum(const uint8_t *raw_buf, float *temp, float *hum) {
    uint32_t hum_raw = ((uint32_t)raw_buf[1] << 12) | ((uint32_t)raw_buf[2] << 4) | (raw_buf[3] >> 4);
    uint32_t temp_raw = (((uint32_t)raw_buf[3] & 0x0F) << 16) | ((uint32_t)raw_buf[4] << 8) | raw_buf[5];

    *hum = ((float)hum_raw / 1048576.0f) * 100.0f;
    *temp = ((float)temp_raw / 1048576.0f) * 200.0f - 50.0f;
}

/**
 * @brief Reads uncompensated raw pressure and temperature values from BMP280 registers.
 * @param[out] adc_P Pointer to store 20-bit raw pressure ADC value.
 * @param[out] adc_T Pointer to store 20-bit raw temperature ADC value.
 * @return stm_status_t STM_OK if I2C memory read succeeded, STM_ERROR otherwise.
 */
static stm_status_t stmi_bmp280_read_raw_pressure(int32_t *adc_P, int32_t *adc_T) {
    uint8_t data_buff[6];
    if (HAL_I2C_Mem_Read(&hi2c1, bmp280_addr, 0xF7, I2C_MEMADD_SIZE_8BIT, data_buff, 6, 100) != HAL_OK) {
        return STM_ERROR;
    }
    *adc_P = ((int32_t)data_buff[0] << 12) | ((int32_t)data_buff[1] << 4) | ((int32_t)data_buff[2] >> 4);
    *adc_T = ((int32_t)data_buff[3] << 12) | ((int32_t)data_buff[4] << 4) | ((int32_t)data_buff[5] >> 4);
    return STM_OK;
}

/**
 * @brief Applies Bosch 64-bit integer compensation formula to compute atmospheric pressure in hPa.
 * @details Computes intermediate temperature factor `t_fine` first, followed by 64-bit fixed-point
 *          pressure compensation using factory calibration coefficients dig_P1..P9.
 * @param[in] adc_P 20-bit uncompensated pressure ADC reading.
 * @param[in] adc_T 20-bit uncompensated temperature ADC reading.
 * @return float Compensated pressure in hectopascals (hPa).
 */
static float stmi_bmp280_compensate_press(int32_t adc_P, int32_t adc_T) {
    int32_t var1_t = ((((adc_T >> 3) - ((int32_t)calib.dig_T1 << 1))) * ((int32_t)calib.dig_T2)) >> 11;
    int32_t var2_t = (((((adc_T >> 4) - ((int32_t)calib.dig_T1)) * ((adc_T >> 4) - ((int32_t)calib.dig_T1))) >> 12) * ((int32_t)calib.dig_T3)) >> 14;
    t_fine = var1_t + var2_t;

    int64_t var1, var2, p;
    var1 = ((int64_t)t_fine) - 128000;
    var2 = var1 * var1 * (int64_t)calib.dig_P6;
    var2 = var2 + ((var1 * (int64_t)calib.dig_P5) << 17);
    var2 = var2 + (((int64_t)calib.dig_P4) << 35);
    var1 = ((var1 * var1 * (int64_t)calib.dig_P3) >> 8) + ((var1 * (int64_t)calib.dig_P2) << 12);
    var1 = (((((int64_t)1) << 47) + var1)) * ((int64_t)calib.dig_P1) >> 33;

    if (var1 == 0) return 0.0f;

    p = 1048576 - adc_P;
    p = (((p << 31) - var2) * 3125) / var1;
    var1 = (((int64_t)calib.dig_P9) * (p >> 13) * (p >> 13)) >> 25;
    var2 = (((int64_t)calib.dig_P8) * p) >> 19;
    p = ((p + var1 + var2) >> 8) + (((int64_t)calib.dig_P7) << 4);

    return (float)p / 256.0f / 100.0f;
}

/**
 * @brief Probes and reads BMP280 factory calibration coefficients from register 0x88.
 * @details Supports both common I2C slave addresses (0x76 and 0x77). Once detected,
 *          configures register 0xF4 (ctrl_meas) to 0x27 (Normal mode, osrs_t x1, osrs_p x1).
 * @return stm_status_t STM_OK if sensor detected and calibrated, STM_ERROR if not responding.
 */
stm_status_t bmp280_read_calibration(void) {
    uint8_t calib_buff[24];
    uint8_t addrs[2] = {0x76 << 1, 0x77 << 1};
    bmp280_addr = 0;

    /* Search for BMP280 on primary (0x76) or secondary (0x77) I2C address */
    for (int i = 0; i < 2; i++) {
        if (HAL_I2C_Mem_Read(&hi2c1, addrs[i], 0x88, I2C_MEMADD_SIZE_8BIT, calib_buff, 24, 100) == HAL_OK) {
            bmp280_addr = addrs[i];
            break;
        }
    }

    if (bmp280_addr == 0) return STM_ERROR;

    /* Parse 24 bytes of factory calibration data */
    calib.dig_T1 = (calib_buff[1] << 8) | calib_buff[0];
    calib.dig_T2 = (calib_buff[3] << 8) | calib_buff[2];
    calib.dig_T3 = (calib_buff[5] << 8) | calib_buff[4];
    calib.dig_P1 = (calib_buff[7] << 8) | calib_buff[6];
    calib.dig_P2 = (calib_buff[9] << 8) | calib_buff[8];
    calib.dig_P3 = (calib_buff[11] << 8) | calib_buff[10];
    calib.dig_P4 = (calib_buff[13] << 8) | calib_buff[12];
    calib.dig_P5 = (calib_buff[15] << 8) | calib_buff[14];
    calib.dig_P6 = (calib_buff[17] << 8) | calib_buff[16];
    calib.dig_P7 = (calib_buff[19] << 8) | calib_buff[18];
    calib.dig_P8 = (calib_buff[21] << 8) | calib_buff[20];
    calib.dig_P9 = (calib_buff[23] << 8) | calib_buff[22];

    /* Set BMP280 control register: normal mode, pressure and temp oversampling x1 */
    uint8_t ctrl_meas = 0x27;
    HAL_I2C_Mem_Write(&hi2c1, bmp280_addr, 0xF4, I2C_MEMADD_SIZE_8BIT, &ctrl_meas, 1, 100);

    is_calibrated = 1;
    return STM_OK;
}

/**
 * @brief Reads environmental data from AHT20 and BMP280 sensors.
 * @details Follows sequence:
 *          1. Trigger and read AHT20 raw bytes, calculate Temperature (°C) and Humidity (%RH).
 *          2. Ensure BMP280 is calibrated, read raw ADC values, and compensate Pressure (hPa).
 * @return stm_status_t STM_OK if all readings succeeded, STM_ERROR if communication fails.
 */
stm_status_t stm_aht20_bmp280_read_data(void) {
    uint8_t aht_raw[6];

    /* Step 1: Read and convert AHT20 temperature and humidity */
    if (stmi_aht20_read_raw_bytes(aht_raw) != STM_OK) {
        g_stm_error_code = STM_ERR_I2C;
        return STM_ERROR;
    }
    stmi_aht20_calc_temp_hum(aht_raw, &g_stm_sensor_data.temperature_degC, &g_stm_sensor_data.humidity_RH);

    /* Step 2: Ensure BMP280 is calibrated */
    if (!is_calibrated) {
        if (bmp280_read_calibration() != STM_OK) {
            g_stm_error_code = STM_ERR_I2C;
            return STM_ERROR;
        }
    }

    /* Step 3: Read uncompensated pressure and apply compensation algorithm */
    int32_t adc_P = 0, adc_T = 0;
    if (stmi_bmp280_read_raw_pressure(&adc_P, &adc_T) != STM_OK) {
        g_stm_error_code = STM_ERR_I2C;
        return STM_ERROR;
    }

    g_stm_sensor_data.pressure_hPa = stmi_bmp280_compensate_press(adc_P, adc_T);
    return STM_OK;
}

