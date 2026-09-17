import test from 'node:test';
import assert from 'node:assert/strict';
import { deriveCompactGeometry, eulerFromFacialTransformationMatrix } from '../../public/analytics/vision-geometry.mjs';

function matrix({ pitch = 0, yaw = 0, roll = 0 } = {}) {
  const x = pitch * Math.PI / 180;
  const y = yaw * Math.PI / 180;
  const z = roll * Math.PI / 180;
  const [cx, sx, cy, sy, cz, sz] = [Math.cos(x), Math.sin(x), Math.cos(y), Math.sin(y), Math.cos(z), Math.sin(z)];
  // Rz * Ry * Rx, row-major.
  return {
    rows: 4,
    columns: 4,
    data: [
      cz * cy, cz * sy * sx - sz * cx, cz * sy * cx + sz * sx, 0,
      sz * cy, sz * sy * sx + cz * cx, sz * sy * cx - cz * sx, 0,
      -sy, cy * sx, cy * cx, 0,
      0, 0, 0, 1,
    ],
  };
}

function sourceResult(transform) {
  const face = Array(200).fill(null);
  face[33] = { x: 0.42, y: 0.35 };
  face[263] = { x: 0.58, y: 0.35 };
  face[1] = { x: 0.5, y: 0.43 };
  face[152] = { x: 0.5, y: 0.58 };
  return { faceLandmarks: [face], facialTransformationMatrixes: [transform] };
}

test('facial transformation matrix produces physical Euler rotations', () => {
  for (const expected of [
    { pitch: 15, yaw: 0, roll: 0 },
    { pitch: 0, yaw: -20, roll: 0 },
    { pitch: 0, yaw: 0, roll: 12 },
    { pitch: 7, yaw: 11, roll: -5 },
  ]) {
    const actual = eulerFromFacialTransformationMatrix(matrix(expected));
    assert(Math.abs(actual.pitchDeg - expected.pitch) < 0.1);
    assert(Math.abs(actual.yawDeg - expected.yaw) < 0.1);
    assert(Math.abs(actual.rollDeg - expected.roll) < 0.1);
  }
});

test('compact geometry prefers matrix head pose and flags proxy fallback', () => {
  const transformed = deriveCompactGeometry(sourceResult(matrix({ pitch: 13, yaw: -17, roll: 4 })), { faceCount: 1 });
  assert.equal(transformed.face.headPoseMethod, 'FACIAL_TRANSFORMATION_MATRIX');
  assert(Math.abs(transformed.face.yawDeg + 17) < 0.1);
  const fallback = deriveCompactGeometry(sourceResult(null), { faceCount: 1 });
  assert.equal(fallback.face.headPoseMethod, 'LINEAR_FACE_GEOMETRY_PROXY');
  assert(Number.isFinite(fallback.face.yawDeg));
});
