// ─────────────────────────────────────────────────────────────────────────────
// Massage Chair Firmware — Arduino
//
// Receives newline-terminated ASCII commands from the Rust backend over USB
// serial and reports back with ACK / ERR / DONE / STATE lines.
//
// Protocol (Rust → Arduino):
//   SET_ANGLE:<chairDeg>            chairDeg in [100,145]  (see gear ratio below)
//   SET_LUMBAR_HEAT:<0-3>
//   SET_UPPER_BACK_HEAT:<0-3>
//   SET_LEG_HEAT:<0-3>
//   SET_LIGHT_R:<r> G:<g> B:<b>     each 0-255
//   SESSION_START
//   SESSION_END
//   GET_STATE
//
// Protocol (Arduino → Rust):
//   READY                          once, on boot
//   ACK:<original_command>         command accepted, action started
//   ERR:<command>:<reason>         command rejected
//   DONE:SET_ANGLE:<chairDeg>      servo has reached the requested angle
//   STATE:ANGLE:<a> LUMBAR:<l> UPPER:<u> LEG:<g> R:<r> G:<g> B:<b> BUSY:<0|1>
//
// Gear ratio: the servo's 18-tooth pinion drives a 45-tooth gear on the
// backrest (45/18 = 2.5:1 reduction). The backend/UI speak in *chair* degrees;
// the firmware multiplies by GEAR_RATIO to get the *servo* angle. A 100→145°
// chair sweep is therefore (145-100)*2.5 = 112.5° of servo travel, well within
// a standard 0–180° servo.
//
// NOTE on pins: an Arduino Uno has only 6 PWM channels and the Servo library
// claims Timer1 (disabling PWM on pins 9 & 10). Driving a servo + 3 heat zones
// + an RGB strip exceeds that, so for production use a board with more PWM
// (e.g. Mega 2560) or external PWM drivers. The pins below are illustrative.
// ─────────────────────────────────────────────────────────────────────────────

#include <Servo.h>

// ── Pin definitions ───────────────────────────────────────────────────────────
const int SERVO_PIN           = 9;
const int LUMBAR_HEAT_PIN     = 3;   // PWM → MOSFET gate → heating element
const int UPPER_BACK_HEAT_PIN = 5;   // PWM
const int LEG_HEAT_PIN        = 6;   // PWM
const int LIGHT_R_PIN         = 10;  // PWM → MOSFET → LED strip
const int LIGHT_G_PIN         = 11;  // PWM
const int LIGHT_B_PIN         = 12;  // (see PWM note above)

// ── Gear / angle configuration ─────────────────────────────────────────────────
const float GEAR_RATIO          = 2.5;   // 45T backrest gear / 18T servo pinion
const int   CHAIR_ANGLE_MIN     = 100;   // matches backend + frontend limits
const int   CHAIR_ANGLE_MAX     = 145;
const int   SERVO_OFFSET_DEG     = 0;    // servo angle that parks the chair at MIN

// ── Heat level → PWM mapping ────────────────────────────────────────────────────
// 0 = off, 1 = low, 2 = medium, 3 = high
const int HEAT_PWM[4] = { 0, 64, 128, 220 };

// ── RGB strip wiring ─────────────────────────────────────────────────────────────
// Common-anode strips sink current, so the PWM duty is inverted.
const bool LIGHT_COMMON_ANODE = true;

// ── Movement timing ───────────────────────────────────────────────────────────
const unsigned long STEP_INTERVAL_MS = 15;  // one chair-degree per step

// ── State ───────────────────────────────────────────────────────────────────────
Servo backrestServo;

int  currentChairAngle = CHAIR_ANGLE_MIN;  // last reached chair angle
int  targetChairAngle  = CHAIR_ANGLE_MIN;
bool moving            = false;
unsigned long lastStepMs = 0;

int  heatLumbar = 0, heatUpper = 0, heatLeg = 0;
int  lightR = 0, lightG = 0, lightB = 0;
bool sessionActive = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
int chairToServo(int chairAngle) {
  // Servo travels GEAR_RATIO× as far as the backrest.
  long servo = (long)SERVO_OFFSET_DEG + lround((chairAngle - CHAIR_ANGLE_MIN) * GEAR_RATIO);
  return constrain((int)servo, 0, 180);
}

void applyLight() {
  int r = LIGHT_COMMON_ANODE ? 255 - lightR : lightR;
  int g = LIGHT_COMMON_ANODE ? 255 - lightG : lightG;
  int b = LIGHT_COMMON_ANODE ? 255 - lightB : lightB;
  analogWrite(LIGHT_R_PIN, r);
  analogWrite(LIGHT_G_PIN, g);
  analogWrite(LIGHT_B_PIN, b);
}

void applyHeat() {
  analogWrite(LUMBAR_HEAT_PIN,     HEAT_PWM[constrain(heatLumbar, 0, 3)]);
  analogWrite(UPPER_BACK_HEAT_PIN, HEAT_PWM[constrain(heatUpper,  0, 3)]);
  analogWrite(LEG_HEAT_PIN,        HEAT_PWM[constrain(heatLeg,    0, 3)]);
}

void sendState() {
  Serial.print("STATE:ANGLE:"); Serial.print(currentChairAngle);
  Serial.print(" LUMBAR:");     Serial.print(heatLumbar);
  Serial.print(" UPPER:");      Serial.print(heatUpper);
  Serial.print(" LEG:");        Serial.print(heatLeg);
  Serial.print(" R:");          Serial.print(lightR);
  Serial.print(" G:");          Serial.print(lightG);
  Serial.print(" B:");          Serial.print(lightB);
  Serial.print(" BUSY:");       Serial.println(moving ? 1 : 0);
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  pinMode(LUMBAR_HEAT_PIN, OUTPUT);
  pinMode(UPPER_BACK_HEAT_PIN, OUTPUT);
  pinMode(LEG_HEAT_PIN, OUTPUT);
  pinMode(LIGHT_R_PIN, OUTPUT);
  pinMode(LIGHT_G_PIN, OUTPUT);
  pinMode(LIGHT_B_PIN, OUTPUT);

  backrestServo.attach(SERVO_PIN);
  backrestServo.write(chairToServo(currentChairAngle));
  applyHeat();
  applyLight();

  Serial.println("READY");
}

// ── Main loop ───────────────────────────────────────────────────────────────────
void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      parseCommand(line);
    }
  }
  serviceMovement();
}

// Step the servo one chair-degree toward the target each interval. When the
// target is reached, emit DONE so the backend can release the UI.
void serviceMovement() {
  if (!moving) return;

  unsigned long now = millis();
  if (now - lastStepMs < STEP_INTERVAL_MS) return;
  lastStepMs = now;

  if (currentChairAngle < targetChairAngle)      currentChairAngle++;
  else if (currentChairAngle > targetChairAngle) currentChairAngle--;

  backrestServo.write(chairToServo(currentChairAngle));

  if (currentChairAngle == targetChairAngle) {
    moving = false;
    Serial.print("DONE:SET_ANGLE:");
    Serial.println(currentChairAngle);
  }
}

// ── Command parser ─────────────────────────────────────────────────────────────
void parseCommand(String cmd) {
  // SET_ANGLE:<chairDeg>
  if (cmd.startsWith("SET_ANGLE:")) {
    int angle = cmd.substring(10).toInt();
    if (angle < CHAIR_ANGLE_MIN || angle > CHAIR_ANGLE_MAX) {
      Serial.println("ERR:SET_ANGLE:LIMIT");
      return;
    }
    targetChairAngle = angle;
    moving = (currentChairAngle != targetChairAngle);
    lastStepMs = millis();
    Serial.println("ACK:SET_ANGLE:" + String(angle));
    if (!moving) {
      // Already at the requested angle — report DONE immediately so the
      // backend clears its "busy" flag.
      Serial.println("DONE:SET_ANGLE:" + String(angle));
    }
    return;
  }

  // SET_LUMBAR_HEAT:<0-3>
  if (cmd.startsWith("SET_LUMBAR_HEAT:")) {
    int level = cmd.substring(16).toInt();
    if (level < 0 || level > 3) { Serial.println("ERR:SET_LUMBAR_HEAT:INVALID"); return; }
    heatLumbar = level;
    applyHeat();
    Serial.println("ACK:SET_LUMBAR_HEAT:" + String(level));
    return;
  }

  // SET_UPPER_BACK_HEAT:<0-3>
  if (cmd.startsWith("SET_UPPER_BACK_HEAT:")) {
    int level = cmd.substring(20).toInt();
    if (level < 0 || level > 3) { Serial.println("ERR:SET_UPPER_BACK_HEAT:INVALID"); return; }
    heatUpper = level;
    applyHeat();
    Serial.println("ACK:SET_UPPER_BACK_HEAT:" + String(level));
    return;
  }

  // SET_LEG_HEAT:<0-3>
  if (cmd.startsWith("SET_LEG_HEAT:")) {
    int level = cmd.substring(13).toInt();
    if (level < 0 || level > 3) { Serial.println("ERR:SET_LEG_HEAT:INVALID"); return; }
    heatLeg = level;
    applyHeat();
    Serial.println("ACK:SET_LEG_HEAT:" + String(level));
    return;
  }

  // SET_LIGHT_R:<r> G:<g> B:<b>
  if (cmd.startsWith("SET_LIGHT_R:")) {
    int r, g, b;
    if (parseLightCmd(cmd, r, g, b)) {
      lightR = constrain(r, 0, 255);
      lightG = constrain(g, 0, 255);
      lightB = constrain(b, 0, 255);
      applyLight();
      Serial.println("ACK:SET_LIGHT_R:" + String(lightR) + " G:" + String(lightG) + " B:" + String(lightB));
    } else {
      Serial.println("ERR:SET_LIGHT:PARSE");
    }
    return;
  }

  // SESSION_START
  if (cmd == "SESSION_START") {
    sessionActive = true;
    Serial.println("ACK:SESSION_START");
    return;
  }

  // SESSION_END — return to neutral: upright, no heat, warm white light
  if (cmd == "SESSION_END") {
    sessionActive = false;
    heatLumbar = heatUpper = heatLeg = 0;
    applyHeat();
    lightR = lightG = lightB = 255;
    applyLight();
    targetChairAngle = CHAIR_ANGLE_MIN;
    moving = (currentChairAngle != targetChairAngle);
    lastStepMs = millis();
    Serial.println("ACK:SESSION_END");
    if (!moving) {
      Serial.println("DONE:SET_ANGLE:" + String(currentChairAngle));
    }
    return;
  }

  // GET_STATE
  if (cmd == "GET_STATE") {
    sendState();
    return;
  }

  Serial.println("ERR:UNKNOWN:" + cmd);
}

// Parse "SET_LIGHT_R:<r> G:<g> B:<b>" into r/g/b. Robust to extra spacing.
bool parseLightCmd(String cmd, int &r, int &g, int &b) {
  int rIdx = cmd.indexOf("R:");
  int gIdx = cmd.indexOf("G:");
  int bIdx = cmd.indexOf("B:");
  if (rIdx < 0 || gIdx < 0 || bIdx < 0) return false;
  if (!(rIdx < gIdx && gIdx < bIdx)) return false;

  r = cmd.substring(rIdx + 2, gIdx).toInt();
  g = cmd.substring(gIdx + 2, bIdx).toInt();
  b = cmd.substring(bIdx + 2).toInt();
  return true;
}

