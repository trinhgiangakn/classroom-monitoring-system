#pragma once

// WiFi configuration
#define WIFI_SSID_DEFAULT "Minhu T1"
#define WIFI_PASS_DEFAULT "Phudien68@"

// MQTT configuration
#define MQTT_SERVER_DEFAULT "630e48d228ed449080ea87a71f32be48.s1.eu.hivemq.cloud"
#define MQTT_PORT_DEFAULT   8883
#define MQTT_USER           "gateway_p101"
#define MQTT_PASS           "gateway123"

// Topic prefixes for MQTT
#define TOPIC_PREFIX_SENSOR   "classroom/P.101/sensor/"
#define TOPIC_PREFIX_DEVICE   "classroom/P.101/device/"
#define TOPIC_GATEWAY_METRICS "classroom/P.101/gateway/metrics"

// Node identifiers for BLE sensors
#define NODE_1 "NODE-NW" 
#define NODE_2 "NODE-NE" 
#define NODE_3 "NODE-SW" 
#define NODE_4 "NODE-SE"

// Device identifiers for relays
#define DEV_FAN        "FAN"
#define DEV_LIGHT      "LIGHT"
#define DEV_CURTAIN    "CURTAIN"
#define DEV_HUMIDIFIER "HUMIDIFIER"

// Relay pin assignments
#define RELAY_FAN         4
#define RELAY_LIGHT       5
#define RELAY_CURTAIN     6
#define RELAY_HUMIDIFIER  7

// Relay states
#define RELAY_ON  HIGH
#define RELAY_OFF LOW  

// Timeout for considering a node offline (in milliseconds)
#define NODE_TIMEOUT_MS 300000 