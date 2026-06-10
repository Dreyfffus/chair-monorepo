// ─────────────────────────────────────────────────────────────────────────────
// Massage Chair Firmware — Arduino Uno
//
// Receives newline-terminated ASCII commands from the Rust backend over USB serial.
// Sends ACK or ERR lines back for every command received.
//
// These are PLACEHOLDERS. 
//
// Heat zones (PWM → MOSFET gate → heating element):
//   LUMBAR_HEAT_PIN, UPPER_BACK_HEAT_PIN, LEG_HEAT_PIN → 0–255 PWM
//
// RGB lighting (PWM → MOSFET → LED strip common anode):
//   LIGHT_R_PIN, LIGHT_G_PIN, LIGHT_B_PIN → 0–255 PWM
// ─────────────────────────────────────────────────────────────────────────────

// ── Pin definitions 


// ── Heat level to PWM value mapping ──────────────────────────────────────────
// 0 = off, 1 = low, 2 = medium, 3 = high
// Adjust these values for your heating element's safe operating range.

const int HEAT_PWM[4] = { 0, 64, 128, 220 };

// ── Angle control ─────────────────────────────────────────────────────────────


//  State 
bool sessionActive = false;

// Setup

void setup() {
  Serial.begin(115200);
  Serial.println("READY");
}

// Main loop

void loop() {
  if (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      parseCommand(line);
    }
  }
}


// Command parser

void parseCommand(String cmd) {
  // SET_ANGLE:<degrees>
  if (cmd.startsWith("SET_ANGLE:")) {
    int angle = cmd.substring(10).toInt();
    if (angle < 90 || angle > 175) {
      Serial.println("ERR:SET_ANGLE:LIMIT");
      return;
    }
    //moveToAngle(angle);
    Serial.println("ACK:SET_ANGLE:" + String(angle));
    return;
  }

  // SET_LUMBAR_HEAT:<0-3>
  if (cmd.startsWith("SET_LUMBAR_HEAT:")) {
    int level = cmd.substring(16).toInt();
    if (level < 0 || level > 3) { Serial.println("ERR:SET_LUMBAR_HEAT:INVALID"); return; }
    //setHeat(LUMBAR_HEAT_PIN, level);
    Serial.println("ACK:SET_LUMBAR_HEAT:" + String(level));
    return;
  }

  // SET_UPPER_BACK_HEAT:<0-3>
  if (cmd.startsWith("SET_UPPER_BACK_HEAT:")) {
    int level = cmd.substring(20).toInt();
    if (level < 0 || level > 3) { Serial.println("ERR:SET_UPPER_BACK_HEAT:INVALID"); return; }
    //setHeat(UPPER_BACK_HEAT_PIN, level);
    Serial.println("ACK:SET_UPPER_BACK_HEAT:" + String(level));
    return;
  }

  // SET_LEG_HEAT:<0-3>
  if (cmd.startsWith("SET_LEG_HEAT:")) {
    int level = cmd.substring(13).toInt();
    if (level < 0 || level > 3) { Serial.println("ERR:SET_LEG_HEAT:INVALID"); return; }
    //setHeat(LEG_HEAT_PIN, level);
    Serial.println("ACK:SET_LEG_HEAT:" + String(level));
    return;
  }

  // SET_LIGHT_R:<r> G:<g> B:<b>
  if (cmd.startsWith("SET_LIGHT_R:")) {
    int r = 255, g = 255, b = 255;
    if (parseLightCmd(cmd, r, g, b)) {
      //setLight(r, g, b);
      Serial.println("ACK:SET_LIGHT_R:" + String(r) + " G:" + String(g) + " B:" + String(b));
    } else {
      Serial.println("ERR:SET_LIGHT:PARSE");
    }
    return;
  }

  // SET_LIGHT_CIRCADIAN
  if (cmd == "SET_LIGHT_CIRCADIAN") {
    // Hardware does not handle circadian calculation —
    // the Rust backend sends the computed RGB via SET_LIGHT_R when in circadian mode.
    // This command is a no-op on the Arduino side; ACK so Rust knows it arrived.
    Serial.println("ACK:SET_LIGHT_CIRCADIAN");
    return;
  }

  // SESSION_START
  if (cmd == "SESSION_START") {
    sessionActive = true;

    Serial.println("ACK:SESSION_START");
    return;
  }

  // SESSION_END
  if (cmd == "SESSION_END") {
    sessionActive = false;
    // Return to neutral: upright, no heat, white light
    //setHeat(LUMBAR_HEAT_PIN,     0);
    //setHeat(UPPER_BACK_HEAT_PIN, 0);
    //setHeat(LEG_HEAT_PIN,        0);
    //setLight(255, 255, 255);
    //moveToAngle(90);
    Serial.println("ACK:SESSION_END");
    return;
  }

  // CALIB_READ — returns the raw ADC value, useful for angle calibration
  if (cmd == "CALIB_READ") {
    Serial.println("CALIB:CALIBRATE");
    return;
  }

  Serial.println("ERR:UNKNOWN:" + cmd);
}


bool parseLightCmd(String cmd, int &r, int &g, int &b) {
  // Expected format: SET_LIGHT_R:255 G:180 B:80
  int rIdx = cmd.indexOf("R:");
  int gIdx = cmd.indexOf("G:");
  int bIdx = cmd.indexOf("B:");

  if (rIdx < 0 || gIdx < 0 || bIdx < 0) return false;

  r = cmd.substring(rIdx + 2, gIdx - 1).toInt();
  g = cmd.substring(gIdx + 2, bIdx - 1).toInt();
  b = cmd.substring(bIdx + 2).toInt();

  return true;
}
// Hardware control functions


