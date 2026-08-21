/**
 * @file stm_ble_adv.c
 * @brief Implementation of HM-10 BLE configuration and telemetry JSON transmission over UART.
 * @details Manages AT command setup for HM-10 module (Role, Mode, Name) and formats
 *          5-channel sensor data into compact JSON strings with 2 decimal places.
 */

#include "stm32f4xx_hal.h"
#include "stm_ble_adv.h"
#include <stdio.h>
#include <string.h>

extern UART_HandleTypeDef huart1;

/**
 * @def CURRENT_NODE_ID
 * @brief Configurable hardware identifier for the sensor node station (1 through 4).
 */
#define CURRENT_NODE_ID 4

/**
 * @brief Transmits a null-terminated string over USART1 to the HM-10 module.
 * @param[in] cmd Null-terminated AT command string or telemetry payload.
 * @return stm_status_t STM_OK if transmission succeeded, STM_ERROR otherwise.
 */
static stm_status_t stmi_uart_transmit_bytes(const char *cmd) {
    if (HAL_UART_Transmit(&huart1, (uint8_t*)cmd, strlen(cmd), 200) != HAL_OK) {
        g_stm_error_code = STM_ERR_UART;
        return STM_ERROR;
    }
    return STM_OK;
}

/**
 * @brief Initializes and configures the HM-10 BLE module in connected transmission mode.
 * @details Sequence:
 *          1. Test UART connectivity with basic "AT" ping.
 *          2. Set broadcast device name to "AT+NAMESensor_<NodeID>".
 *          3. Set role to Peripheral/Slave ("AT+ROLE0") so central devices (Gateway/Phone) can connect.
 *          4. Set operation mode to Transparent UART transmission ("AT+MODE0").
 *          5. Issue software reset ("AT+RESET") to commit and apply configurations.
 * @return stm_status_t STM_OK on success.
 */
stm_status_t stm_ble_init(void) {
    /* 1. Verify UART communication with module */
    stmi_uart_transmit_bytes("AT");
    HAL_Delay(150);

    /* 2. Configure fixed broadcast device name (e.g. "Sensor_4") */
    char name_cmd[32];
    snprintf(name_cmd, sizeof(name_cmd), "AT+NAMESensor_%d", CURRENT_NODE_ID);
    stmi_uart_transmit_bytes(name_cmd);
    HAL_Delay(150);

    /* 3. Configure role: Peripheral (Slave) for central connection */
    stmi_uart_transmit_bytes("AT+ROLE0");
    HAL_Delay(150);

    /* 4. Configure working mode: Mode 0 (Transparent UART pass-through) */
    stmi_uart_transmit_bytes("AT+MODE0");
    HAL_Delay(150);

    /* 5. Restart HM-10 module to apply configurations */
    stmi_uart_transmit_bytes("AT+RESET");
    HAL_Delay(300);

    return STM_OK;
}

/**
 * @brief Serializes sensor telemetry into JSON and transmits over UART to HM-10.
 * @details Separates integer and fractional parts (2 decimal places) for each measurement
 *          to avoid requiring the `-u _printf_float` linker flag, saving Flash memory.
 *          When connected, HM-10 automatically transmits this string over BLE GATT (UUID 0xFFE1).
 * @return stm_status_t STM_OK on success, STM_ERROR if UART transmission fails.
 */
stm_status_t stm_ble_send_data(void) {
    char data_buffer[128];

    /* Split integer and 2-digit decimal parts with +0.5f rounding to eliminate float truncation artifacts */
    int t_int = (int)g_stm_sensor_data.temperature_degC;
    float t_diff = (g_stm_sensor_data.temperature_degC - (float)t_int) * 100.0f;
    int t_dec = (int)(t_diff >= 0.0f ? (t_diff + 0.5f) : (-t_diff + 0.5f));
    if (t_dec >= 100) { t_dec = 99; }

    int h_int = (int)g_stm_sensor_data.humidity_RH;
    float h_diff = (g_stm_sensor_data.humidity_RH - (float)h_int) * 100.0f;
    int h_dec = (int)(h_diff >= 0.0f ? (h_diff + 0.5f) : (-h_diff + 0.5f));
    if (h_dec >= 100) { h_dec = 99; }

    int p_int = (int)g_stm_sensor_data.pressure_hPa;
    float p_diff = (g_stm_sensor_data.pressure_hPa - (float)p_int) * 100.0f;
    int p_dec = (int)(p_diff >= 0.0f ? (p_diff + 0.5f) : (-p_diff + 0.5f));
    if (p_dec >= 100) { p_dec = 99; }

    int l_int = (int)g_stm_sensor_data.light_lux;
    float l_diff = (g_stm_sensor_data.light_lux - (float)l_int) * 100.0f;
    int l_dec = (int)(l_diff >= 0.0f ? (l_diff + 0.5f) : (-l_diff + 0.5f));
    if (l_dec >= 100) { l_dec = 99; }

    int q_int = (int)g_stm_sensor_data.air_quality_ppm;
    float q_diff = (g_stm_sensor_data.air_quality_ppm - (float)q_int) * 100.0f;
    int q_dec = (int)(q_diff >= 0.0f ? (q_diff + 0.5f) : (-q_diff + 0.5f));
    if (q_dec >= 100) { q_dec = 99; }

    /* Format compact JSON telemetry payload */
    snprintf(data_buffer, sizeof(data_buffer),
             "{\"node\":%d,\"temp\":%d.%02d,\"hum\":%d.%02d,\"press\":%d.%02d,\"lux\":%d.%02d,\"ppm\":%d.%02d}\r\n",
             CURRENT_NODE_ID,
             t_int, t_dec,
             h_int, h_dec,
             p_int, p_dec,
             l_int, l_dec,
             q_int, q_dec);

    return stmi_uart_transmit_bytes(data_buffer);
}

/**
 * @brief Backward compatibility wrapper routing to stm_ble_send_data().
 * @return stm_status_t STM_OK on success, STM_ERROR on failure.
 */
stm_status_t stm_ble_send_advertising(void) {
    return stm_ble_send_data();
}

