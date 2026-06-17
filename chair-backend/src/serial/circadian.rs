// Server-side circadian colour.
//
// The Arduino has no clock and cannot compute a time-of-day colour, so when a
// preset is in "circadian" mode the backend resolves the current colour here
// and sends a concrete RGB over the wire (a plain SET_LIGHT_R command). This
// mirrors `LIGHT_STOPS` / `getCircadianLightColor` in the frontend so the LED
// strip matches the on-screen ambience.

use chrono::{Local, Timelike};

/// How often the backend re-resolves the circadian colour and re-sends it to
/// the chair during an active circadian session. The stops shift over minutes,
/// so a minute cadence keeps the strip in step without flooding the serial bus.
pub const CIRCADIAN_RESEND_SECS: u64 = 60;

type Hsl = (f64, f64, f64); // (hue 0–360, sat %, light %)

// Keep these stops in sync with chair-frontend/src/utils/colors.ts (LIGHT_STOPS).
const LIGHT_STOPS: &[(i32, Hsl)] = &[
    (0, (20.0, 85.0, 8.0)),
    (300, (20.0, 85.0, 8.0)),
    (360, (28.0, 90.0, 35.0)),
    (480, (36.0, 75.0, 62.0)),
    (600, (45.0, 50.0, 78.0)),
    (780, (195.0, 20.0, 88.0)),
    (900, (45.0, 50.0, 78.0)),
    (1080, (36.0, 75.0, 62.0)),
    (1140, (28.0, 90.0, 35.0)),
    (1320, (20.0, 85.0, 12.0)),
    (1440, (20.0, 85.0, 8.0)),
];

fn lerp_hsl(a: Hsl, b: Hsl, t: f64) -> Hsl {
    let mut dh = b.0 - a.0;
    if dh > 180.0 {
        dh -= 360.0;
    }
    if dh < -180.0 {
        dh += 360.0;
    }
    (a.0 + dh * t, a.1 + (b.1 - a.1) * t, a.2 + (b.2 - a.2) * t)
}

fn hsl_to_rgb((h, s, l): Hsl) -> (u8, u8, u8) {
    let s = s / 100.0;
    let l = l / 100.0;
    let a = s * l.min(1.0 - l);
    let f = |n: f64| -> u8 {
        let k = (n + h / 30.0) % 12.0;
        let color = l - a * (k - 3.0).min(9.0 - k).min(1.0).max(-1.0);
        (255.0 * color).round().clamp(0.0, 255.0) as u8
    };
    (f(0.0), f(8.0), f(4.0))
}

fn interpolate(minutes: i32) -> (u8, u8, u8) {
    for w in LIGHT_STOPS.windows(2) {
        let (m1, c1) = w[0];
        let (m2, c2) = w[1];
        if minutes >= m1 && minutes < m2 {
            return hsl_to_rgb(lerp_hsl(c1, c2, (minutes - m1) as f64 / (m2 - m1) as f64));
        }
    }
    hsl_to_rgb(LIGHT_STOPS[0].1)
}

/// Circadian RGB for the local wall-clock time right now.
pub fn circadian_rgb_now() -> (u8, u8, u8) {
    let now = Local::now();
    let minutes = now.hour() as i32 * 60 + now.minute() as i32;
    interpolate(minutes)
}
