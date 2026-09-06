import { PILOT_CANDIDATES } from './pilot-authoring.mjs';
import { PILOT_CANDIDATES_B } from './pilot-authoring-b.mjs';

const NONPERIODIC_SECOND_PASS_ORDER = Object.freeze([0, 2, 1, 3, 5, 4, 7, 6, 10, 11, 8, 9]);

export const PILOT_LIBRARY = Object.freeze([
  ...PILOT_CANDIDATES,
  ...NONPERIODIC_SECOND_PASS_ORDER.map((index) => PILOT_CANDIDATES_B[index]),
]);
