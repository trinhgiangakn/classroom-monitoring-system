/**
 * @file stm_ble_adv.h
 * @brief Header for HM-10 BLE module configuration and telemetry transmission.
 * @details Handles UART AT command configuration (Name, Role, Mode) and serializes
 *          multi-sensor telemetry into formatted JSON payload for BLE GATT transmission.
 */

#ifndef STM_BLE_ADV_H
#define STM_BLE_ADV_H

#include "stm32f4xx_hal.h"
#include "sensor_types.h"

/**
 * @brief Initializes and configures the HM-10 BLE module in Peripheral / Transparent mode.
 * @details Sends AT handshake, sets broadcast device name (e.g. "Sensor_<ID>"),
 *          configures role to Peripheral (ROLE 0), enables transparent transmission (MODE 0),
 *          and resets the module to apply settings.
 * @return STM_OK if all AT commands succeeded; STM_ERROR otherwise.
 */
stm_status_t stm_ble_init(void);

/**
 * @brief Formats and transmits sensor measurements as a JSON string over UART to HM-10.
 * @details Serializes 5 sensor parameters (temp, hum, press, lux, ppm) with 2 decimal places
 *          into a JSON string and sends via USART1. When connected, HM-10 forwards this data over BLE.
 * @return STM_OK on successful transmission; STM_ERROR on UART failure.
 */
stm_status_t stm_ble_send_data(void);

/**
 * @brief Compatibility wrapper invoking stm_ble_send_data().
 * @return STM_OK on success, STM_ERROR on failure.
 */
stm_status_t stm_ble_send_advertising(void);

#endif /* STM_BLE_ADV_H */



