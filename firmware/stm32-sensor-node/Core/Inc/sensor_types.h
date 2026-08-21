/**
 * @file sensor_types.h
 * @brief Common data structures, status codes, and error flags for STM32 sensor node.
 * @details Defines system status enums, peripheral/sensor error bitmasks,
 *          and the aggregate sensor measurement data container.
 */

#ifndef SENSOR_TYPES_H
#define SENSOR_TYPES_H

#include <stdint.h>

/**
 * @brief General function execution status.
 */
typedef enum {
    STM_OK    = 0, /**< Operation completed successfully */
    STM_ERROR = 1  /**< Operation failed or encountered an error */
} stm_status_t;

/**
 * @defgroup STM_ERROR_FLAGS Sensor Node Error Flags (Bitmask)
 * @{
 */
#define STM_ERR_NONE            0x00000000 /**< No error reported */
#define STM_ERR_I2C             0x00000001 /**< I2C bus communication error */
#define STM_ERR_ADC             0x00000002 /**< ADC conversion or sampling error */
#define STM_ERR_UART            0x00000004 /**< UART transmission or reception error */
#define STM_ERR_AHT20_BMP280    0x00000010 /**< AHT20 / BMP280 sensor read error */
#define STM_ERR_BH1750          0x00000020 /**< BH1750 ambient light sensor error */
#define STM_ERR_MQ135           0x00000040 /**< MQ-135 air quality sensor error */
/** @} */

/**
 * @brief Aggregated sensor measurement structure.
 * @details Holds the latest floating-point engineering values sampled from all on-board sensors.
 */
typedef struct {
    float temperature_degC; /**< Ambient temperature in degrees Celsius (°C) */
    float humidity_RH;       /**< Relative humidity in percentage (%RH) */
    float pressure_hPa;      /**< Atmospheric pressure in hectopascals (hPa) */
    float light_lux;         /**< Ambient light intensity in Lux */
    float air_quality_ppm;   /**< Air quality / gas concentration in parts-per-million (PPM) */
} stm_sensor_data_t;

/** @brief Global aggregate sensor telemetry data buffer. */
extern stm_sensor_data_t g_stm_sensor_data;

/** @brief Global bitmask representing active hardware and sensor error codes. */
extern uint32_t g_stm_error_code;

#endif /* SENSOR_TYPES_H */

