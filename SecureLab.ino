#include <BLEDevice.h>
#include <BLEServer.h>
#include <BLEUtils.h>
#include <BLE2902.h>

#define SERVICE_UUID        "4fafc201-1fb5-459e-8fcc-c5c9c331914b"
#define CHARACTERISTIC_UUID "beb5483e-36e1-4688-b7f5-ea07361b26a8"

#define RELAY_UNLOCK_PIN 25  // Broche pour relais déverrouillage
#define RELAY_LOCK_PIN 26    // Broche pour relais verrouillage

BLECharacteristic *pCharacteristic;
bool deviceConnected = false;

class MyServerCallbacks: public BLEServerCallbacks {
    void onConnect(BLEServer* pServer) {
      deviceConnected = true;
      Serial.println("Client connecte");
    };

    void onDisconnect(BLEServer* pServer) {
      deviceConnected = false;
      Serial.println("Client deconnecte");
    }
};

class MyCallbacks: public BLECharacteristicCallbacks {
    void onWrite(BLECharacteristic *pCharacteristic) {
      std::string value = pCharacteristic->getValue();

      if (value.length() > 0) {
        uint8_t command = value[0];
        
        if (command == 1) {
          // Déverrouiller
          digitalWrite(RELAY_UNLOCK_PIN, HIGH);
          Serial.println("Deverrouillage");
          delay(3000);
          digitalWrite(RELAY_UNLOCK_PIN, LOW);
        } 
        else if (command == 2) {
          // Verrouiller
          digitalWrite(RELAY_LOCK_PIN, HIGH);
          Serial.println("Verrouillage");
          delay(3000);
          digitalWrite(RELAY_LOCK_PIN, LOW);
        }
      }
    }
};

void setup() {
  Serial.begin(115200);
  
  pinMode(RELAY_UNLOCK_PIN, OUTPUT);
  pinMode(RELAY_LOCK_PIN, OUTPUT);
  digitalWrite(RELAY_UNLOCK_PIN, LOW);
  digitalWrite(RELAY_LOCK_PIN, LOW);

  BLEDevice::init("ESP32");
  BLEServer *pServer = BLEDevice::createServer();
  pServer->setCallbacks(new MyServerCallbacks());

  BLEService *pService = pServer->createService(SERVICE_UUID);

  pCharacteristic = pService->createCharacteristic(
                      CHARACTERISTIC_UUID,
                      BLECharacteristic::PROPERTY_READ |
                      BLECharacteristic::PROPERTY_WRITE
                    );

  pCharacteristic->setCallbacks(new MyCallbacks());
  pCharacteristic->addDescriptor(new BLE2902());

  pService->start();

  BLEAdvertising *pAdvertising = BLEDevice::getAdvertising();
  pAdvertising->addServiceUUID(SERVICE_UUID);
  pAdvertising->setScanResponse(true);
  pAdvertising->setMinPreferred(0x06);
  pAdvertising->setMinPreferred(0x12);
  BLEDevice::startAdvertising();
  
  Serial.println("ESP32 BLE pret!");
}

void loop() {
  delay(100);
}
