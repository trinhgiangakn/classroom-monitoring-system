#include <ArduinoJson.h>
#include <NimBLEDevice.h> 
#include "task_ble.h"
#include "shared_data.h"
#include "task_mqtt.h"
#include "config.h"

// BLE service identifiers and connection state.
static BLEUUID serviceUUID("FFE0");
static BLEUUID charUUID("FFE1");

// BLE clients, discovered devices, connection flags, and receive buffers.
static NimBLEClient* pClients[4] = {nullptr, nullptr, nullptr, nullptr};
static NimBLEAdvertisedDevice* foundDevices[4] = {nullptr, nullptr, nullptr, nullptr};
static bool doConnect[4] = {false, false, false, false};
static bool connected[4] = {false, false, false, false};

// BLE receive buffers and indices for each sensor node.
static char ble_rx_buffers[4][256];
static int ble_rx_index[4] = {0, 0, 0, 0};

// Process incoming JSON data from BLE notifications for a specific node.
static void processJsonBuffer(int node_index, char c) {
    if (c < 32 || c > 126) {
        if (c != '\n' && c != '\r') return; 
    }

    if (ble_rx_index[node_index] >= 255) {
        Serial.printf("[ERR] Node %d Buffer Overflow! Resetting...\n", node_index);
        ble_rx_index[node_index] = 0;
        return;
    }

    ble_rx_buffers[node_index][ble_rx_index[node_index]++] = c;

    if (c == '\n') {
        ble_rx_buffers[node_index][ble_rx_index[node_index]] = '\0';

        StaticJsonDocument<256> doc_in;
        DeserializationError err = deserializeJson(doc_in, ble_rx_buffers[node_index]);

        if (!err && doc_in.containsKey("node")) {
            int node_id = doc_in["node"]; 
            
            if (node_id - 1 == node_index) {
                mqtt_msg_t sensor_msg;
                snprintf(sensor_msg.topic, sizeof(sensor_msg.topic), "%s%s/telemetry", 
                         TOPIC_PREFIX_SENSOR, NODE_IDS[node_index].c_str());

                StaticJsonDocument<256> doc_out;
                doc_out["temperature"] = doc_in["temp"];
                doc_out["humidity"]    = doc_in["hum"];
                doc_out["light_lux"]   = doc_in["lux"];
                doc_out["air_quality"] = doc_in["ppm"];
                doc_out["pressure"]    = doc_in["press"];

                serializeJson(doc_out, sensor_msg.payload, sizeof(sensor_msg.payload));

                if (xQueueSend(mqtt_queue, &sensor_msg, 0) != pdPASS) {
                    mqtt_msg_t dummy_msg;
                    xQueueReceive(mqtt_queue, &dummy_msg, 0); 
                    
                    xQueueSend(mqtt_queue, &sensor_msg, 0);
                }
                
                update_node_data(node_index, doc_in["temp"], doc_in["hum"], doc_in["lux"], doc_in["ppm"], doc_in["press"]);
            }
        }
        
        ble_rx_index[node_index] = 0; 
    }
}

// BLE notification callbacks for each sensor node.
static void notifyCb0(BLERemoteCharacteristic* p, uint8_t* d, size_t l, bool n) { for(size_t i=0; i<l; i++) processJsonBuffer(0, (char)d[i]);}
static void notifyCb1(BLERemoteCharacteristic* p, uint8_t* d, size_t l, bool n) { for(size_t i=0; i<l; i++) processJsonBuffer(1, (char)d[i]);}
static void notifyCb2(BLERemoteCharacteristic* p, uint8_t* d, size_t l, bool n) { for(size_t i=0; i<l; i++) processJsonBuffer(2, (char)d[i]);}
static void notifyCb3(BLERemoteCharacteristic* p, uint8_t* d, size_t l, bool n) { for(size_t i=0; i<l; i++) processJsonBuffer(3, (char)d[i]);}

// Notification callback table indexed by node.
typedef void (*NotifyCb_t)(BLERemoteCharacteristic*, uint8_t*, size_t, bool);
NotifyCb_t notifyCallbacks[4] = {notifyCb0, notifyCb1, notifyCb2, notifyCb3};

// Handle BLE client connection events.
class MyClientCallback : public NimBLEClientCallbacks {
    int node_idx;
public:
    MyClientCallback(int idx) : node_idx(idx) {}

    void onConnect(NimBLEClient* pclient) {
        connected[node_idx] = true;
        Serial.printf("[BLE] Đã duy trì kết nối song song với Sensor_%d!\n", node_idx + 1);
    }

    void onDisconnect(NimBLEClient* pclient) {
        connected[node_idx] = false;
        Serial.printf("[BLE] Mất kết nối với Sensor_%d. Hệ thống sẽ tự động quét lại...\n", node_idx + 1);
    }
};

// Handle discovered BLE sensor devices.
class MyAdvertisedDeviceCallbacks : public NimBLEAdvertisedDeviceCallbacks {
    void onResult(NimBLEAdvertisedDevice* advertisedDevice) {
        if (advertisedDevice->haveName()) {
            String devName = advertisedDevice->getName().c_str();
            
            if (devName.startsWith("Sensor_")) {
                int node_idx = devName.substring(7).toInt() - 1; 

                if (node_idx >= 0 && node_idx <= 3 && !connected[node_idx] && !doConnect[node_idx]) {
                    Serial.printf("[BLE] Tìm thấy %s. Tạm dừng quét để móc nối...\n", devName.c_str());
                    
                    NimBLEDevice::getScan()->stop();
                    foundDevices[node_idx] = new NimBLEAdvertisedDevice(*advertisedDevice);
                    doConnect[node_idx] = true;
                }
            }
        }
    }
};

// Scan for sensors and maintain BLE connections.
void task_ble_scan(void *pvParameters) {
    NimBLEDevice::init("");
    NimBLEScan* pBLEScan = NimBLEDevice::getScan();
    pBLEScan->setAdvertisedDeviceCallbacks(new MyAdvertisedDeviceCallbacks());
    pBLEScan->setInterval(100); 
    pBLEScan->setWindow(99);
    pBLEScan->setActiveScan(true);

    for (;;) {
        bool all_connected = true;

        for (int i = 0; i < 4; i++) {
            
            if (doConnect[i]) {
                if (foundDevices[i] != nullptr) {
                    
                    if (pClients[i] == nullptr) {
                        pClients[i] = NimBLEDevice::createClient();
                        pClients[i]->setClientCallbacks(new MyClientCallback(i));
                    }

                    if (pClients[i]->connect(foundDevices[i])) {
                        NimBLERemoteService* pRemoteService = pClients[i]->getService(serviceUUID);
                        if (pRemoteService != nullptr) {
                            NimBLERemoteCharacteristic* pRemoteChar = pRemoteService->getCharacteristic(charUUID);
                            
                            if (pRemoteChar != nullptr && pRemoteChar->canNotify()) {
                                pRemoteChar->subscribe(true, notifyCallbacks[i]);
                            }
                        }
                    }
                    
                    delete foundDevices[i];
                    foundDevices[i] = nullptr;
                }
                doConnect[i] = false;
            }

            if (!connected[i]) {
                all_connected = false;
            }
        }

        if (!all_connected) {
            pBLEScan->start(3, false);
            pBLEScan->clearResults();
        }

        vTaskDelay(1000 / portTICK_PERIOD_MS); 
    }
}