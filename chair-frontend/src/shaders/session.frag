precision mediump float;

uniform vec2 u_resolution;
uniform float u_time;
uniform float u_progress;
uniform vec3 u_light_hsl;
uniform vec3 u_bg_hsl;
uniform float u_hue_delta;


float hue2rgb(float p, float q, float t) {
    if (t < 0.0) t += 1.0;
    if (t > 1.0) t -= 1.0;
    if (t < 0.16667) return p + (q - p) * 6.0 * t;
    if (t < 0.5)     return q;
    if (t < 0.66667) return p + (q - p) * (0.66667 - t) * 6.0;
    return p;
}

vec3 hslToRgb(float h, float s, float l) {
    h = mod(h, 360.0) / 360.0;
    if (s < 0.001) return vec3(l);
    float q = l < 0.5 ? l * (1.0 + s) : l + s - l * s;
    float p = 2.0 * l - q;
    return vec3(
        hue2rgb(p, q, h + 0.33333),
        hue2rgb(p, q, h),
        hue2rgb(p, q, h - 0.33333)
    );
}

void main() {
    vec2 uv = gl_FragCoord.xy / u_resolution;

    float amp = 1.0 - min(u_progress * 1.2, 0.9);
    float wave =
        sin(uv.x * 3.00 + u_time * 0.80) * 0.040 * amp +
        sin(uv.x * 4.85 + u_time * 1.30) * 0.025 * amp +
        sin(uv.x * 7.85 + u_time * 2.10) * 0.015 * amp +
        sin(uv.x * 12.7 + u_time * 3.40) * 0.007 * amp;

    float baseHeight  = 0.9 - 0.89 * u_progress;
    float gradientTop = clamp(baseHeight + wave, 0.01, 0.95);

    float t     = clamp(uv.y / gradientTop, 0.0, 1.0);
    float bloom = pow(1.0 - smoothstep(0.0, 1.0, t), 1.8);

    float colorT = min(u_progress * 0.65, 0.65);
    float h = u_light_hsl.x + u_hue_delta * colorT;
    float s = u_light_hsl.y + (u_bg_hsl.y - u_light_hsl.y) * colorT;
    float l = u_light_hsl.z + (u_bg_hsl.z - u_light_hsl.z) * colorT;

    vec3 glowRgb = hslToRgb(h, s, l);
    vec3 bgRgb   = hslToRgb(u_bg_hsl.x, u_bg_hsl.y, u_bg_hsl.z);

    gl_FragColor = vec4(mix(bgRgb, glowRgb, bloom), 1.0);
}
