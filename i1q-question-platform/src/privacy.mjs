import { REQUIRED_PRIVACY_CLASSES } from './contracts.mjs';

const DETECTORS = Object.freeze({
  email: /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/giu,
  phone: /\b(?:\+?1[ .-]?)?\(?\d{3}\)?[ .-]\d{3}[ .-]\d{4}\b/gu,
  address: /\b\d{1,6}\s+[A-Za-z][A-Za-z .'-]{1,60}\s(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Drive|Dr)\b/giu,
  patient_identifier: /\b(?:PATIENT|PAT|MRN|MEDICAL RECORD)[\s:._-]*(?:[A-Z0-9][\s:._-]*){4,20}\b/giu,
  student_name: /\[STUDENT_NAME:[^\]]+\]/giu,
  third_party_name: /\[THIRD_PARTY_NAME:[^\]]+\]/giu,
});

export function redactText(input) {
  let text = String(input || '').normalize('NFC');
  const findings = [];
  for (const privacyClass of REQUIRED_PRIVACY_CLASSES) {
    const pattern = DETECTORS[privacyClass];
    text = text.replace(pattern, (match) => {
      findings.push({ privacy_class: privacyClass, match_length: match.length });
      return `[REDACTED_${privacyClass.toUpperCase()}]`;
    });
  }
  return { redacted_text: text, findings };
}

export function scorePrivacyAggregate({ labels = [], detections = [] }) {
  const result = {
    denominator_zero_policy: 'FAIL_REQUIRED_CLASS_WITHOUT_GOLD_LABEL',
    required_classes: {},
    status: 'pass',
  };

  for (const privacyClass of REQUIRED_PRIVACY_CLASSES) {
    const classLabels = labels.filter((label) => label.privacy_class === privacyClass);
    const classDetections = detections.filter((detection) => detection.privacy_class === privacyClass);
    const matched = classLabels.filter((label) => classDetections.some((detection) => detection.label_id === label.id)).length;
    const denominator = classLabels.length;
    const missing = denominator === 0;
    const recall = missing ? 0 : matched / denominator;
    const precision = classDetections.length === 0 ? 0 : matched / classDetections.length;
    const status = missing ? 'fail_missing_required_class' : 'pass';
    result.required_classes[privacyClass] = {
      denominator,
      detections: classDetections.length,
      matched,
      precision: Number(precision),
      recall: Number(recall),
      status,
    };
    if (status !== 'pass') {
      result.status = 'fail';
    }
  }

  return result;
}
