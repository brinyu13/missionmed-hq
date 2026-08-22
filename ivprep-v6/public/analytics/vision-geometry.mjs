function point(landmarks, index) {
  const value = landmarks?.[index];
  if (!value || !Number.isFinite(value.x) || !Number.isFinite(value.y)) return null;
  return { x: value.x, y: value.y, z: Number.isFinite(value.z) ? value.z : 0, visibility: Number.isFinite(value.visibility) ? value.visibility : 1 };
}

function distance(a, b) {
  return a && b ? Math.hypot(a.x - b.x, a.y - b.y) : null;
}

function midpoint(a, b) {
  return a && b ? { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, z: (a.z + b.z) / 2 } : null;
}

function angleDegrees(dx, dy) {
  return Math.atan2(dx, Math.max(Math.abs(dy), 1e-6)) * 180 / Math.PI;
}

function round(value, places = 4) {
  return Number.isFinite(value) ? Number(value.toFixed(places)) : null;
}

function faceBox(face) {
  if (!face?.length) return null;
  let left = 1;
  let top = 1;
  let right = 0;
  let bottom = 0;
  for (const value of face) {
    if (!Number.isFinite(value?.x) || !Number.isFinite(value?.y)) continue;
    left = Math.min(left, value.x);
    top = Math.min(top, value.y);
    right = Math.max(right, value.x);
    bottom = Math.max(bottom, value.y);
  }
  if (right <= left || bottom <= top) return null;
  return { left: round(left), top: round(top), width: round(right - left), height: round(bottom - top), centerX: round((left + right) / 2), centerY: round((top + bottom) / 2) };
}

function compactHand(hand, shoulderCenter, shoulderWidth) {
  const wrist = point(hand, 0);
  const indexTip = point(hand, 8);
  const pinkyTip = point(hand, 20);
  if (!wrist || !indexTip || !pinkyTip) return { present: false };
  const center = midpoint(indexTip, pinkyTip);
  const scale = Math.max(shoulderWidth || 0.2, 0.05);
  const zone = shoulderCenter
    ? (center.y < shoulderCenter.y - scale * 0.5 ? 'above-shoulders' : center.y > shoulderCenter.y + scale * 0.7 ? 'below-chest' : 'chest')
    : 'unresolved';
  return {
    present: true,
    wristX: round(wrist.x),
    wristY: round(wrist.y),
    centerX: round(center.x),
    centerY: round(center.y),
    zone,
  };
}

export function normalizedTemporalDelta(current, prior, currentAtMs, priorAtMs, referenceMs = 125) {
  if (![current, prior, currentAtMs, priorAtMs, referenceMs].every(Number.isFinite) || currentAtMs <= priorAtMs || referenceMs <= 0) return null;
  return round(Math.abs(current - prior) * referenceMs / (currentAtMs - priorAtMs));
}

export function facialMovementRate(currentCategories, priorCategories, elapsedMs) {
  if (!Array.isArray(currentCategories) || !Array.isArray(priorCategories) || !Number.isFinite(elapsedMs) || elapsedMs <= 0) return null;
  const scores = (categories) => new Map(categories
    .map((category) => [String(category?.categoryName || category?.displayName || ''), Number(category?.score)])
    .filter(([name, score]) => name && Number.isFinite(score) && name !== '_neutral' && !/^eyeLook/iu.test(name)));
  const current = scores(currentCategories);
  const prior = scores(priorCategories);
  const names = [...new Set([...current.keys(), ...prior.keys()])];
  if (!names.length) return null;
  const meanDelta = names.reduce((sum, name) => sum + Math.abs((current.get(name) || 0) - (prior.get(name) || 0)), 0) / names.length;
  return round(meanDelta / (elapsedMs / 1_000));
}

export function deriveCompactGeometry(result, { faceCount = null } = {}) {
  const face = result?.faceLandmarks?.[0] || null;
  const pose = result?.poseLandmarks?.[0] || null;
  const leftShoulder = point(pose, 11);
  const rightShoulder = point(pose, 12);
  const leftHip = point(pose, 23);
  const rightHip = point(pose, 24);
  const shoulderCenter = midpoint(leftShoulder, rightShoulder);
  const hipCenter = midpoint(leftHip, rightHip);
  const shoulderWidth = distance(leftShoulder, rightShoulder);
  const upperBodyVisible = Boolean(
    shoulderCenter && shoulderWidth
    && leftShoulder.visibility >= 0.5 && rightShoulder.visibility >= 0.5
  );
  const torsoVisible = Boolean(
    upperBodyVisible && hipCenter
    && leftHip.visibility >= 0.4 && rightHip.visibility >= 0.4
  );

  const leftEye = point(face, 33);
  const rightEye = point(face, 263);
  const nose = point(face, 1);
  const chin = point(face, 152);
  const eyeCenter = midpoint(leftEye, rightEye);
  const eyeDistance = distance(leftEye, rightEye);
  const facePresent = Boolean(face && face.length >= 100 && eyeCenter && nose && chin && eyeDistance > 0.01);
  const yawProxy = facePresent ? ((nose.x - eyeCenter.x) / eyeDistance) * 35 : null;
  const faceHeight = facePresent ? Math.max(Math.abs(chin.y - eyeCenter.y), 0.01) : null;
  const pitchProxy = facePresent ? (((nose.y - eyeCenter.y) / faceHeight) - 0.45) * 45 : null;
  const rollProxy = facePresent ? Math.atan2(rightEye.y - leftEye.y, rightEye.x - leftEye.x) * 180 / Math.PI : null;
  const torsoLean = torsoVisible ? angleDegrees(shoulderCenter.x - hipCenter.x, shoulderCenter.y - hipCenter.y) : null;

  return Object.freeze({
    faceCount: Number.isFinite(faceCount) ? Math.max(0, Math.round(faceCount)) : null,
    face: Object.freeze({
      present: facePresent,
      box: facePresent ? faceBox(face) : null,
      yawProxyDeg: round(yawProxy, 2),
      pitchProxyDeg: round(pitchProxy, 2),
      rollProxyDeg: round(rollProxy, 2),
    }),
    pose: Object.freeze({
      upperBodyPresent: upperBodyVisible,
      torsoPresent: torsoVisible,
      shoulderWidth: round(shoulderWidth),
      centerX: round(shoulderCenter?.x),
      centerY: round(shoulderCenter?.y),
      lateralLeanDeg: round(torsoLean, 2),
    }),
    hands: Object.freeze({
      left: Object.freeze(compactHand(result?.leftHandLandmarks?.[0], shoulderCenter, shoulderWidth)),
      right: Object.freeze(compactHand(result?.rightHandLandmarks?.[0], shoulderCenter, shoulderWidth)),
    }),
  });
}

export function assertCompactGeometry(value) {
  const serialized = JSON.stringify(value);
  if (serialized.length > 4_000) throw new TypeError('Compact geometry exceeds its privacy budget.');
  if (/landmark|blendshape|embedding|pixel|image|bitmap/iu.test(serialized)) throw new TypeError('Raw visual material escaped compact geometry.');
  return true;
}
