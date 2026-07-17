export function testUuid(value) {
  const number = BigInt(value);
  return `00000000-0000-4000-8000-${number.toString(16).padStart(12, "0")}`;
}

export const TEST_SUBJECTS = Object.freeze({
  student: testUuid(0x1001),
  studentB: testUuid(0x1002),
  mentor: testUuid(0x2001),
  admin: testUuid(0x3001),
  integration: testUuid(0x4001),
  deletionWorker: testUuid(0x4002),
  apiStudent: testUuid(0x5001),
  httpStudent: testUuid(0x5002),
  stressStudent: testUuid(0x5003)
});
