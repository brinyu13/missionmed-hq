const forbiddenInferencePatterns = [
  /\b(?:clinically|psychologically)\s+(?:fit|ready|competent)\b/i,
  /\b(?:emotion|personality|deception|honesty|anxiety|stress)\s+(?:score|inference|assessment)\b/i,
  /\b(?:match probability|program fit|rankability|readiness score)\b/i,
  /\b(?:will|likely to)\s+match\b/i,
  /\b(?:lying|evasive|deceptive)\b/i,
  /\b(?:accent|native language)\s+(?:quality|score|problem|weakness)\b/i,
];

const privateReasoningPatterns = [
  /\bchain[- ]of[- ]thought\b/i,
  /\bprivate reasoning\b/i,
  /\bhidden (?:prompt|reasoning|instructions?)\b/i,
  /\bsystem prompt\b/i,
];

const credentialPatterns = [
  /\b(?:api[_-]?key|service[_-]?role|private[_-]?key|password|bearer)\s*[:=]\s*\S+/i,
  /\b(?:sk|pk)_[A-Za-z0-9_-]{20,}\b/,
  /\beyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\b/,
];

const realDataPatterns = [
  /\b(?:patient|applicant|student)\s+(?:name|email|phone|address)\s*[:=]/i,
  /\b\d{3}-\d{2}-\d{4}\b/,
  /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i,
];

function matches(patterns, value) {
  return patterns.filter((pattern) => pattern.test(value)).map((pattern) => pattern.source);
}

export function scanText(value) {
  const text = String(value);
  const forbiddenInferences = matches(forbiddenInferencePatterns, text);
  const privateReasoning = matches(privateReasoningPatterns, text);
  const credentials = matches(credentialPatterns, text);
  const realData = matches(realDataPatterns, text);
  return {
    forbidden_inferences: forbiddenInferences,
    private_reasoning: privateReasoning,
    credentials,
    real_data: realData,
    pass: forbiddenInferences.length === 0 && privateReasoning.length === 0 && credentials.length === 0 && realData.length === 0,
  };
}

export function scanJson(value) {
  return scanText(JSON.stringify(value));
}
