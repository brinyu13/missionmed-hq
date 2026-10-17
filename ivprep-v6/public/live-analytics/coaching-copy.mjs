// Y1-Y2-CAM-V6-3526 — frozen, claim-safe student coaching copy bank.

export const COACHING_COPY = Object.freeze({
  pace: Object.freeze({ low: '↑ PICK UP PACE', target: '✓ HOLD', high: '↓ SLOW DOWN', holding: 'HOLDING LAST VALID' }),
  volume: Object.freeze({ low: '↑ SPEAK UP', target: '✓ HOLD', high: '↓ EASE VOLUME', silent: '—' }),
  pitch: Object.freeze({ low: '↑ ADD VOCAL VARIETY', target: '✓ HEALTHY VARIATION', high: '↓ STEADY DELIVERY', unvoiced: 'UNVOICED', establishing: 'ESTABLISHING SPEAKER RANGE', relative: 'SPEAKER-RELATIVE REGISTER' }),
  gesture: Object.freeze({ low: 'FREE A HAND', target: 'HEALTHY', high: 'SETTLE', hidden: 'HANDS NOT VISIBLE', listening: 'LISTENING — NO GESTURE JUDGMENT' }),
  setup: Object.freeze({
    audio: 'Raise your input volume in System Settings, or move closer to the microphone.',
    camera: 'Align your head inside the guide.',
    moveBack: 'Move back until your full upper body is visible.',
    center: 'Re-center in the camera frame.',
  }),
});

export function corridorState(value, minimum, maximum) {
  if (![value, minimum, maximum].every(Number.isFinite)) return 'unavailable';
  if (value < minimum) return 'low';
  if (value > maximum) return 'high';
  return 'target';
}
