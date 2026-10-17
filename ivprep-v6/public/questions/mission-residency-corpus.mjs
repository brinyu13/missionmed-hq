// GENERATED FILE - DO NOT EDIT BY HAND.
//
// Regenerate with:  node scripts/questions/import-mvp-corpus.mjs
//
// Seed question corpus for IV Prep On-Call, imported from the Fable 3494A MVP
// question import manifest (Y1-Y2-CAM-V6-3494A), which is itself the authoritative
// verbatim extraction of the Founder-supplied source PDFs.
//
// Source manifest SHA-256: 53a25dc49b0083b7069b14dbaf07f4f7528c920f0ee326ac8e34e8f6fac32cec
//
// Counts: 10 CORE + 142 MR142 + 41 BEHAVIORAL
//         + 1 BEHAVIORAL collection description record.
//
// canonical_text is VERBATIM, including deliberate source typos flagged [sic]
// (9 records). Text is immutable per revision: MissionMed edits create a new
// revision with edited_from provenance, they never rewrite these strings in place.
//
// EXCLUDED BY LAW and structurally absent: "Questions to Ask the Faculty",
// "Questions to Ask the Program Director", "Questions to Ask the Residents".
// Those are applicant-asked questions, not interviewer questions.
//
// difficulty is an import-time seed heuristic (difficulty_origin:
// 'import_seed_heuristic'), NOT Fable-authored. It is curation-editable.
// links[] is intentionally empty: duplicate review is an explicit later,
// non-destructive process that only ever adds LINK relations.

export const CORPUS_MANIFEST_SHA256 = '53a25dc49b0083b7069b14dbaf07f4f7528c920f0ee326ac8e34e8f6fac32cec';

export const QUESTION_TAXONOMY = Object.freeze(["CORE","TRADITIONAL","PERSONAL","BACKGROUND","MOTIVATION","SPECIALTY","PROGRAM_FIT","BEHAVIORAL","SITUATIONAL","CONFLICT","TEAMWORK","LEADERSHIP","FAILURE","MISTAKE_SAFETY","ETHICS","STRESS_PRESSURE","STRENGTHS","WEAKNESSES","HOBBIES","CAREER_GOALS","CV_BASED","RESEARCH","CLINICAL_EXPERIENCE","PATIENT_INTERACTION","COMMUNICATION","ADVERSITY","RED_FLAGS","HEALTHCARE_POLICY","CREATIVE_UNUSUAL","CLOSING"]);

export const EXCLUDED_SOURCE_SECTIONS = Object.freeze(["Questions to Ask the Faculty","Questions to Ask the Program Director","Questions to Ask the Residents"]);

export const BEHAVIORAL_COLLECTION = Object.freeze({
  "question_id": "BEH-042",
  "collection": "BEHAVIORAL",
  "is_collection_description": true,
  "canonical_text": "(Preamble text retained as collection description, not a question: behavioral premise — \"future behavior is best predicted by past behavior.\")",
  "revision": 1,
  "source": "mr_behavioral",
  "source_number": 42,
  "provenance": {
    "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
  }
});

export const SEED_QUESTIONS = Object.freeze([
  {
    "question_id": "CORE-01",
    "canonical_text": "Tell me about yourself.",
    "revision": 1,
    "source": "founder_core",
    "source_number": 1,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-005"
    }
  },
  {
    "question_id": "CORE-02",
    "canonical_text": "What are your hobbies? / What do you do in your spare time?",
    "revision": 1,
    "source": "founder_core",
    "source_number": 2,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-035, MR142-116"
    }
  },
  {
    "question_id": "CORE-03",
    "canonical_text": "Where do you see yourself five years from now?",
    "revision": 1,
    "source": "founder_core",
    "source_number": 3,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-093, MR142-118"
    }
  },
  {
    "question_id": "CORE-04",
    "canonical_text": "What have you been doing since you graduated medical school?",
    "revision": 1,
    "source": "founder_core",
    "source_number": 4,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "— (CORE-only; IMG-relevant)"
    }
  },
  {
    "question_id": "CORE-05",
    "canonical_text": "What are your strengths?",
    "revision": 1,
    "source": "founder_core",
    "source_number": 5,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-013 (partial)"
    }
  },
  {
    "question_id": "CORE-06",
    "canonical_text": "Why did you choose this specialty?",
    "revision": 1,
    "source": "founder_core",
    "source_number": 6,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-066"
    }
  },
  {
    "question_id": "CORE-07",
    "canonical_text": "How do you handle conflict?",
    "revision": 1,
    "source": "founder_core",
    "source_number": 7,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-062"
    }
  },
  {
    "question_id": "CORE-08",
    "canonical_text": "What is your greatest weakness?",
    "revision": 1,
    "source": "founder_core",
    "source_number": 8,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-013 (partial)"
    }
  },
  {
    "question_id": "CORE-09",
    "canonical_text": "What type of patients do you find hardest to deal with?",
    "revision": 1,
    "source": "founder_core",
    "source_number": 9,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-061"
    }
  },
  {
    "question_id": "CORE-10",
    "canonical_text": "Tell me about an error that you made in patient care.",
    "revision": 1,
    "source": "founder_core",
    "source_number": 10,
    "tags": [
      "CORE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": true,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "planned",
      "woods": "planned"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md",
      "manifest_cross_refs": "≈MR142-091"
    }
  },
  {
    "question_id": "MR142-001",
    "canonical_text": "List three accomplishments of which you are most proud of and what each accomplishment indicates about you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 1,
    "tags": [
      "TRADITIONAL",
      "PERSONAL",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-002",
    "canonical_text": "List three abilities you have that will make you valuable as a resident in this specialty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 2,
    "tags": [
      "STRENGTHS",
      "SPECIALTY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-003",
    "canonical_text": "What clinical experience have you had in this specialty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 3,
    "tags": [
      "CLINICAL_EXPERIENCE",
      "SPECIALTY",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-004",
    "canonical_text": "Do you have any questions?",
    "revision": 1,
    "source": "mr142",
    "source_number": 4,
    "tags": [
      "CLOSING"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": false,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-005",
    "canonical_text": "Tell me about yourself?",
    "revision": 1,
    "source": "mr142",
    "source_number": 5,
    "tags": [
      "TRADITIONAL",
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-006",
    "canonical_text": "What three adjectives best describe you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 6,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-007",
    "canonical_text": "What might give me a better picture of you than I can get from your resume?",
    "revision": 1,
    "source": "mr142",
    "source_number": 7,
    "tags": [
      "PERSONAL",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-008",
    "canonical_text": "Tell me a story about yourself that best describes you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 8,
    "tags": [
      "PERSONAL",
      "BEHAVIORAL"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-009",
    "canonical_text": "f you were going to die in 5 minutes, what would you tell someone about yourself? [sic]",
    "revision": 1,
    "source": "mr142",
    "source_number": 9,
    "tags": [
      "CREATIVE_UNUSUAL",
      "PERSONAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-010",
    "canonical_text": "Of which accomplishments are you most proud?",
    "revision": 1,
    "source": "mr142",
    "source_number": 10,
    "tags": [
      "PERSONAL",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-011",
    "canonical_text": "Are there any hidden achievements or qualities that you are secretly proud of?",
    "revision": 1,
    "source": "mr142",
    "source_number": 11,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-012",
    "canonical_text": "How have you changed since high school?",
    "revision": 1,
    "source": "mr142",
    "source_number": 12,
    "tags": [
      "BACKGROUND",
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-013",
    "canonical_text": "What are your strengths and weaknesses?",
    "revision": 1,
    "source": "mr142",
    "source_number": 13,
    "tags": [
      "STRENGTHS",
      "WEAKNESSES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-014",
    "canonical_text": "Tell me about your \"secret identity\" – The part of your personality that you don't share with strangers?",
    "revision": 1,
    "source": "mr142",
    "source_number": 14,
    "tags": [
      "CREATIVE_UNUSUAL",
      "PERSONAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-015",
    "canonical_text": "Any skeletons in your closet you want to tell me about?",
    "revision": 1,
    "source": "mr142",
    "source_number": 15,
    "tags": [
      "RED_FLAGS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-016",
    "canonical_text": "How well do you take criticism?",
    "revision": 1,
    "source": "mr142",
    "source_number": 16,
    "tags": [
      "PERSONAL",
      "COMMUNICATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-017",
    "canonical_text": "What's your pet peeve?",
    "revision": 1,
    "source": "mr142",
    "source_number": 17,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-018",
    "canonical_text": "If you could change one thing about your personality what would it be?",
    "revision": 1,
    "source": "mr142",
    "source_number": 18,
    "tags": [
      "WEAKNESSES",
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-019",
    "canonical_text": "If you could be any cell in the human body, which would you be and why?",
    "revision": 1,
    "source": "mr142",
    "source_number": 19,
    "tags": [
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-020",
    "canonical_text": "Do you see yourself as more relaxed/casual/informal or more serious/dedicated/committed?",
    "revision": 1,
    "source": "mr142",
    "source_number": 20,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-021",
    "canonical_text": "What is more important, the ability to organize, structure, and prioritize or to be flexible, modify, change and make do as needed?",
    "revision": 1,
    "source": "mr142",
    "source_number": 21,
    "tags": [
      "PERSONAL",
      "SITUATIONAL"
    ],
    "style": [
      "situational"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-022",
    "canonical_text": "Which is more important, knowledge or imagination?",
    "revision": 1,
    "source": "mr142",
    "source_number": 22,
    "tags": [
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-023",
    "canonical_text": "Strangest Halloween costume you ever wore?",
    "revision": 1,
    "source": "mr142",
    "source_number": 23,
    "tags": [
      "CREATIVE_UNUSUAL",
      "HOBBIES"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-024",
    "canonical_text": "What do you value in your own life?",
    "revision": 1,
    "source": "mr142",
    "source_number": 24,
    "tags": [
      "PERSONAL",
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-025",
    "canonical_text": "If you had unlimited money and (x amount of time) what would you do?",
    "revision": 1,
    "source": "mr142",
    "source_number": 25,
    "tags": [
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-026",
    "canonical_text": "3 wishes, what would they be?",
    "revision": 1,
    "source": "mr142",
    "source_number": 26,
    "tags": [
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-027",
    "canonical_text": "What kinds of people are your friends?",
    "revision": 1,
    "source": "mr142",
    "source_number": 27,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-028",
    "canonical_text": "Describe your best friend?",
    "revision": 1,
    "source": "mr142",
    "source_number": 28,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-029",
    "canonical_text": "How are you similar and dissimilar to your best friend?",
    "revision": 1,
    "source": "mr142",
    "source_number": 29,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-030",
    "canonical_text": "How would your friends or co‐workers describe you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 30,
    "tags": [
      "PERSONAL",
      "TEAMWORK"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-031",
    "canonical_text": "Who are your heroes?",
    "revision": 1,
    "source": "mr142",
    "source_number": 31,
    "tags": [
      "PERSONAL",
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-032",
    "canonical_text": "What is your favorite movie, book?",
    "revision": 1,
    "source": "mr142",
    "source_number": 32,
    "tags": [
      "HOBBIES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-033",
    "canonical_text": "What is the last book you read?",
    "revision": 1,
    "source": "mr142",
    "source_number": 33,
    "tags": [
      "HOBBIES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-034",
    "canonical_text": "What do success and failure mean to you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 34,
    "tags": [
      "PERSONAL",
      "FAILURE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-035",
    "canonical_text": "What do you do in your spare time?",
    "revision": 1,
    "source": "mr142",
    "source_number": 35,
    "tags": [
      "HOBBIES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-036",
    "canonical_text": "Favorite games/sports? Why?",
    "revision": 1,
    "source": "mr142",
    "source_number": 36,
    "tags": [
      "HOBBIES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-037",
    "canonical_text": "Have you done any volunteer work?",
    "revision": 1,
    "source": "mr142",
    "source_number": 37,
    "tags": [
      "BACKGROUND",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-038",
    "canonical_text": "How did you choose these outside activities?",
    "revision": 1,
    "source": "mr142",
    "source_number": 38,
    "tags": [
      "HOBBIES",
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-039",
    "canonical_text": "If you had a completely free day, what would you do?",
    "revision": 1,
    "source": "mr142",
    "source_number": 39,
    "tags": [
      "HOBBIES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-040",
    "canonical_text": "Describe for me your typical day?",
    "revision": 1,
    "source": "mr142",
    "source_number": 40,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-041",
    "canonical_text": "What is the most bizarre thing you have ever done (in college, high school, etc)?",
    "revision": 1,
    "source": "mr142",
    "source_number": 41,
    "tags": [
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-042",
    "canonical_text": "What is the most unusual occurrence in your life in the past (x amount of time)?",
    "revision": 1,
    "source": "mr142",
    "source_number": 42,
    "tags": [
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-043",
    "canonical_text": "Which organizations do you belong to?",
    "revision": 1,
    "source": "mr142",
    "source_number": 43,
    "tags": [
      "BACKGROUND",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-044",
    "canonical_text": "What are your plans for a family?",
    "revision": 1,
    "source": "mr142",
    "source_number": 44,
    "tags": [
      "RED_FLAGS",
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-045",
    "canonical_text": "If could not be a physician, what career would you choose?",
    "revision": 1,
    "source": "mr142",
    "source_number": 45,
    "tags": [
      "MOTIVATION",
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-046",
    "canonical_text": "Why choose to be a doctor?",
    "revision": 1,
    "source": "mr142",
    "source_number": 46,
    "tags": [
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-047",
    "canonical_text": "How do you make important decisions?",
    "revision": 1,
    "source": "mr142",
    "source_number": 47,
    "tags": [
      "PERSONAL",
      "SITUATIONAL"
    ],
    "style": [
      "situational"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-048",
    "canonical_text": "Are you a risk taker or safety minded?",
    "revision": 1,
    "source": "mr142",
    "source_number": 48,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-049",
    "canonical_text": "What made you choose your undergraduate major?",
    "revision": 1,
    "source": "mr142",
    "source_number": 49,
    "tags": [
      "BACKGROUND"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-050",
    "canonical_text": "How did you select undergraduate college and medical school?",
    "revision": 1,
    "source": "mr142",
    "source_number": 50,
    "tags": [
      "BACKGROUND"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-051",
    "canonical_text": "What were the major deficiencies in your medical school training? How would you plan to remedy this?",
    "revision": 1,
    "source": "mr142",
    "source_number": 51,
    "tags": [
      "BACKGROUND",
      "WEAKNESSES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-052",
    "canonical_text": "If you could begin your schooling again, what would you change?",
    "revision": 1,
    "source": "mr142",
    "source_number": 52,
    "tags": [
      "BACKGROUND",
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-053",
    "canonical_text": "Have you ever dropped a class, why?",
    "revision": 1,
    "source": "mr142",
    "source_number": 53,
    "tags": [
      "RED_FLAGS",
      "BACKGROUND"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-054",
    "canonical_text": "Have you ever quit or been fired from a job?",
    "revision": 1,
    "source": "mr142",
    "source_number": 54,
    "tags": [
      "RED_FLAGS",
      "BACKGROUND"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-055",
    "canonical_text": "Biggest failures in life and what have you done to ensure that they won't happen again?",
    "revision": 1,
    "source": "mr142",
    "source_number": 55,
    "tags": [
      "FAILURE",
      "ADVERSITY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-056",
    "canonical_text": "Have you always done the best work of which you are capable?",
    "revision": 1,
    "source": "mr142",
    "source_number": 56,
    "tags": [
      "PERSONAL",
      "WEAKNESSES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-057",
    "canonical_text": "Which types of people do you have problems working with?",
    "revision": 1,
    "source": "mr142",
    "source_number": 57,
    "tags": [
      "TEAMWORK",
      "CONFLICT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-058",
    "canonical_text": "What qualities drive you crazy in colleagues?",
    "revision": 1,
    "source": "mr142",
    "source_number": 58,
    "tags": [
      "TEAMWORK",
      "CONFLICT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-059",
    "canonical_text": "Describe the best/worst attending with whom you have ever worked?",
    "revision": 1,
    "source": "mr142",
    "source_number": 59,
    "tags": [
      "CLINICAL_EXPERIENCE",
      "TEAMWORK"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-060",
    "canonical_text": "Do you prefer to work under supervision or on your own?",
    "revision": 1,
    "source": "mr142",
    "source_number": 60,
    "tags": [
      "TEAMWORK",
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-061",
    "canonical_text": "With which patients do you have trouble dealing?",
    "revision": 1,
    "source": "mr142",
    "source_number": 61,
    "tags": [
      "PATIENT_INTERACTION",
      "CONFLICT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-062",
    "canonical_text": "How do you normally handle conflict?",
    "revision": 1,
    "source": "mr142",
    "source_number": 62,
    "tags": [
      "CONFLICT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-063",
    "canonical_text": "How do you respond when you have problems with someone?",
    "revision": 1,
    "source": "mr142",
    "source_number": 63,
    "tags": [
      "CONFLICT",
      "COMMUNICATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-064",
    "canonical_text": "What do you do if someone senior tells you to do something you know is wrong?",
    "revision": 1,
    "source": "mr142",
    "source_number": 64,
    "tags": [
      "ETHICS",
      "SITUATIONAL",
      "MISTAKE_SAFETY"
    ],
    "style": [
      "situational"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-065",
    "canonical_text": "With what subject/rotation did you have the most difficulty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 65,
    "tags": [
      "WEAKNESSES",
      "CLINICAL_EXPERIENCE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-066",
    "canonical_text": "Why do you want to go into this specialty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 66,
    "tags": [
      "SPECIALTY",
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-067",
    "canonical_text": "What would you be willing to sacrifice to become a physician in this specialty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 67,
    "tags": [
      "SPECIALTY",
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-068",
    "canonical_text": "What is the greatest sacrifice you have already made to get to where you are?",
    "revision": 1,
    "source": "mr142",
    "source_number": 68,
    "tags": [
      "ADVERSITY",
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-069",
    "canonical_text": "If your chosen specialty did not exist, what would you do?",
    "revision": 1,
    "source": "mr142",
    "source_number": 69,
    "tags": [
      "SPECIALTY",
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-070",
    "canonical_text": "How much did lifestyle considerations fit into your choice of specialty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 70,
    "tags": [
      "SPECIALTY",
      "RED_FLAGS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-071",
    "canonical_text": "Why did you apply to this program?",
    "revision": 1,
    "source": "mr142",
    "source_number": 71,
    "tags": [
      "PROGRAM_FIT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-072",
    "canonical_text": "What qualities are you looking for in a program?",
    "revision": 1,
    "source": "mr142",
    "source_number": 72,
    "tags": [
      "PROGRAM_FIT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-073",
    "canonical_text": "What interests you most about this program?",
    "revision": 1,
    "source": "mr142",
    "source_number": 73,
    "tags": [
      "PROGRAM_FIT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-074",
    "canonical_text": "What have you heard about our program that you don't like?",
    "revision": 1,
    "source": "mr142",
    "source_number": 74,
    "tags": [
      "PROGRAM_FIT",
      "RED_FLAGS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-075",
    "canonical_text": "Are you applying here because it is a familiar environment?",
    "revision": 1,
    "source": "mr142",
    "source_number": 75,
    "tags": [
      "PROGRAM_FIT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-076",
    "canonical_text": "What will be the toughest aspect of this specialty for you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 76,
    "tags": [
      "SPECIALTY",
      "WEAKNESSES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-077",
    "canonical_text": "How will you handle the least interesting or least pleasant parts of this specialty's practice?",
    "revision": 1,
    "source": "mr142",
    "source_number": 77,
    "tags": [
      "SPECIALTY",
      "SITUATIONAL"
    ],
    "style": [
      "situational"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-078",
    "canonical_text": "What qualities are most important in this specialty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 78,
    "tags": [
      "SPECIALTY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-079",
    "canonical_text": "What kind of qualities does a person need to be an effective physician?",
    "revision": 1,
    "source": "mr142",
    "source_number": 79,
    "tags": [
      "TRADITIONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-080",
    "canonical_text": "Why should we take you over other applicants?",
    "revision": 1,
    "source": "mr142",
    "source_number": 80,
    "tags": [
      "PROGRAM_FIT",
      "STRENGTHS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-081",
    "canonical_text": "What can you add to our program?",
    "revision": 1,
    "source": "mr142",
    "source_number": 81,
    "tags": [
      "PROGRAM_FIT",
      "STRENGTHS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-082",
    "canonical_text": "What computer experience do you have?",
    "revision": 1,
    "source": "mr142",
    "source_number": 82,
    "tags": [
      "CV_BASED",
      "BACKGROUND"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-083",
    "canonical_text": "Describe your ideal residency program?",
    "revision": 1,
    "source": "mr142",
    "source_number": 83,
    "tags": [
      "PROGRAM_FIT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-084",
    "canonical_text": "What is your energy level like?",
    "revision": 1,
    "source": "mr142",
    "source_number": 84,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-085",
    "canonical_text": "How many hours of sleep do you require each night?",
    "revision": 1,
    "source": "mr142",
    "source_number": 85,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-086",
    "canonical_text": "How well do you function under pressure?",
    "revision": 1,
    "source": "mr142",
    "source_number": 86,
    "tags": [
      "STRESS_PRESSURE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-087",
    "canonical_text": "How do you handle stress?",
    "revision": 1,
    "source": "mr142",
    "source_number": 87,
    "tags": [
      "STRESS_PRESSURE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-088",
    "canonical_text": "Can you handle stress without the resources you are accustomed to relying on?",
    "revision": 1,
    "source": "mr142",
    "source_number": 88,
    "tags": [
      "STRESS_PRESSURE",
      "ADVERSITY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-089",
    "canonical_text": "Tell me about the patient from whom you learned the most?",
    "revision": 1,
    "source": "mr142",
    "source_number": 89,
    "tags": [
      "PATIENT_INTERACTION",
      "BEHAVIORAL",
      "CLINICAL_EXPERIENCE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-090",
    "canonical_text": "Most memorable experience in medical school/college?",
    "revision": 1,
    "source": "mr142",
    "source_number": 90,
    "tags": [
      "BACKGROUND",
      "BEHAVIORAL"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-091",
    "canonical_text": "What errors have you made in patient care?",
    "revision": 1,
    "source": "mr142",
    "source_number": 91,
    "tags": [
      "MISTAKE_SAFETY",
      "FAILURE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-092",
    "canonical_text": "Greatest fear about practicing medicine?",
    "revision": 1,
    "source": "mr142",
    "source_number": 92,
    "tags": [
      "PERSONAL",
      "RED_FLAGS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-093",
    "canonical_text": "Where do you see yourself in 5‐10 years?",
    "revision": 1,
    "source": "mr142",
    "source_number": 93,
    "tags": [
      "CAREER_GOALS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-094",
    "canonical_text": "How do you see the delivery of health care evolving in the 21st century?",
    "revision": 1,
    "source": "mr142",
    "source_number": 94,
    "tags": [
      "HEALTHCARE_POLICY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-095",
    "canonical_text": "Is health care a right or a privilege?",
    "revision": 1,
    "source": "mr142",
    "source_number": 95,
    "tags": [
      "HEALTHCARE_POLICY",
      "ETHICS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-096",
    "canonical_text": "What problems will our specialty face in the next 5‐10 years?",
    "revision": 1,
    "source": "mr142",
    "source_number": 96,
    "tags": [
      "SPECIALTY",
      "HEALTHCARE_POLICY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-097",
    "canonical_text": "What would you do if the house staff had a strike?",
    "revision": 1,
    "source": "mr142",
    "source_number": 97,
    "tags": [
      "SITUATIONAL",
      "ETHICS"
    ],
    "style": [
      "situational"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-098",
    "canonical_text": "What do you think of what's happening in mid east? Congress? Economy?",
    "revision": 1,
    "source": "mr142",
    "source_number": 98,
    "tags": [
      "HEALTHCARE_POLICY",
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-099",
    "canonical_text": "Teach me something non‐medical in 5 minutes?",
    "revision": 1,
    "source": "mr142",
    "source_number": 99,
    "tags": [
      "CREATIVE_UNUSUAL",
      "COMMUNICATION"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-100",
    "canonical_text": "Where else have you interviewed?",
    "revision": 1,
    "source": "mr142",
    "source_number": 100,
    "tags": [
      "RED_FLAGS",
      "CLOSING"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": false,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-101",
    "canonical_text": "What if you don't match?",
    "revision": 1,
    "source": "mr142",
    "source_number": 101,
    "tags": [
      "RED_FLAGS",
      "STRESS_PRESSURE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-102",
    "canonical_text": "Can you think of anything else you would like to add?",
    "revision": 1,
    "source": "mr142",
    "source_number": 102,
    "tags": [
      "CLOSING"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": false,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-103",
    "canonical_text": "How do you deal/cope with failure, give example?",
    "revision": 1,
    "source": "mr142",
    "source_number": 103,
    "tags": [
      "FAILURE",
      "BEHAVIORAL"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-104",
    "canonical_text": "What was your favorite course in medical school?",
    "revision": 1,
    "source": "mr142",
    "source_number": 104,
    "tags": [
      "BACKGROUND"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-105",
    "canonical_text": "Describe a conflict you had with someone and how it was resolved?",
    "revision": 1,
    "source": "mr142",
    "source_number": 105,
    "tags": [
      "CONFLICT",
      "BEHAVIORAL"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-106",
    "canonical_text": "Describe something that was very difficult in your life, how you dealt with it, and what you learned from it?",
    "revision": 1,
    "source": "mr142",
    "source_number": 106,
    "tags": [
      "ADVERSITY",
      "BEHAVIORAL"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-107",
    "canonical_text": "What needs to be changed in our health care system?",
    "revision": 1,
    "source": "mr142",
    "source_number": 107,
    "tags": [
      "HEALTHCARE_POLICY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-108",
    "canonical_text": "How can you do your job more effectively?",
    "revision": 1,
    "source": "mr142",
    "source_number": 108,
    "tags": [
      "PERSONAL",
      "CLINICAL_EXPERIENCE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-109",
    "canonical_text": "What is the most pressing problem in medicine today?",
    "revision": 1,
    "source": "mr142",
    "source_number": 109,
    "tags": [
      "HEALTHCARE_POLICY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-110",
    "canonical_text": "What is the most rewarding thing you have ever done?",
    "revision": 1,
    "source": "mr142",
    "source_number": 110,
    "tags": [
      "PERSONAL",
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-111",
    "canonical_text": "Tell me some of your successes?",
    "revision": 1,
    "source": "mr142",
    "source_number": 111,
    "tags": [
      "STRENGTHS",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-112",
    "canonical_text": "Tell me some of your failures?",
    "revision": 1,
    "source": "mr142",
    "source_number": 112,
    "tags": [
      "FAILURE",
      "WEAKNESSES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-113",
    "canonical_text": "How do you show your commitment to medicine?",
    "revision": 1,
    "source": "mr142",
    "source_number": 113,
    "tags": [
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-114",
    "canonical_text": "Who is the most influential in your life?",
    "revision": 1,
    "source": "mr142",
    "source_number": 114,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-115",
    "canonical_text": "What is the worst thing that has ever happened to you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 115,
    "tags": [
      "ADVERSITY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-116",
    "canonical_text": "What do you do for fun?",
    "revision": 1,
    "source": "mr142",
    "source_number": 116,
    "tags": [
      "HOBBIES"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-117",
    "canonical_text": "When did you decide you wanted to be a physician?",
    "revision": 1,
    "source": "mr142",
    "source_number": 117,
    "tags": [
      "MOTIVATION",
      "BACKGROUND"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-118",
    "canonical_text": "Where do you see yourself in 10 years?",
    "revision": 1,
    "source": "mr142",
    "source_number": 118,
    "tags": [
      "CAREER_GOALS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-119",
    "canonical_text": "What leadership roles have you held?",
    "revision": 1,
    "source": "mr142",
    "source_number": 119,
    "tags": [
      "LEADERSHIP",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-120",
    "canonical_text": "What are the biggest problems in medicine and in your chosen specialty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 120,
    "tags": [
      "HEALTHCARE_POLICY",
      "SPECIALTY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-121",
    "canonical_text": "What do you think of socialized medicine?",
    "revision": 1,
    "source": "mr142",
    "source_number": 121,
    "tags": [
      "HEALTHCARE_POLICY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-122",
    "canonical_text": "Do you know how hard residency is?",
    "revision": 1,
    "source": "mr142",
    "source_number": 122,
    "tags": [
      "RED_FLAGS",
      "STRESS_PRESSURE"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-123",
    "canonical_text": "Do you want research to be a part of your career?",
    "revision": 1,
    "source": "mr142",
    "source_number": 123,
    "tags": [
      "RESEARCH",
      "CAREER_GOALS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-124",
    "canonical_text": "What is your most important accomplishment?",
    "revision": 1,
    "source": "mr142",
    "source_number": 124,
    "tags": [
      "PERSONAL",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-125",
    "canonical_text": "What makes you different from everyone else?",
    "revision": 1,
    "source": "mr142",
    "source_number": 125,
    "tags": [
      "PERSONAL",
      "STRENGTHS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-126",
    "canonical_text": "What do you expect out of your residency?",
    "revision": 1,
    "source": "mr142",
    "source_number": 126,
    "tags": [
      "PROGRAM_FIT",
      "CAREER_GOALS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-127",
    "canonical_text": "What is your most important lesson learned from childhood?",
    "revision": 1,
    "source": "mr142",
    "source_number": 127,
    "tags": [
      "PERSONAL",
      "BACKGROUND"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-128",
    "canonical_text": "What do you expect will be the hardest part of residency for you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 128,
    "tags": [
      "WEAKNESSES",
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-129",
    "canonical_text": "Who in your family are you closest to?",
    "revision": 1,
    "source": "mr142",
    "source_number": 129,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-130",
    "canonical_text": "What makes you happy?",
    "revision": 1,
    "source": "mr142",
    "source_number": 130,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-131",
    "canonical_text": "What makes you sad?",
    "revision": 1,
    "source": "mr142",
    "source_number": 131,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-132",
    "canonical_text": "What makes you unique?",
    "revision": 1,
    "source": "mr142",
    "source_number": 132,
    "tags": [
      "PERSONAL",
      "STRENGTHS"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-133",
    "canonical_text": "Is there anything else not in application that you want to tell me?",
    "revision": 1,
    "source": "mr142",
    "source_number": 133,
    "tags": [
      "CLOSING",
      "CV_BASED"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": true,
    "behavioral": false,
    "followup_eligible": false,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-134",
    "canonical_text": "How do your friends describe you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 134,
    "tags": [
      "PERSONAL"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-135",
    "canonical_text": "3 people you would invite to dinner and why?",
    "revision": 1,
    "source": "mr142",
    "source_number": 135,
    "tags": [
      "CREATIVE_UNUSUAL"
    ],
    "style": [
      "creative"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-136",
    "canonical_text": "Describe important relationships you have had with people?",
    "revision": 1,
    "source": "mr142",
    "source_number": 136,
    "tags": [
      "PERSONAL",
      "COMMUNICATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-137",
    "canonical_text": "Anything else you want to tell me about yourself?",
    "revision": 1,
    "source": "mr142",
    "source_number": 137,
    "tags": [
      "CLOSING"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": false,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-138",
    "canonical_text": "What was your most difficult challenge in life?",
    "revision": 1,
    "source": "mr142",
    "source_number": 138,
    "tags": [
      "ADVERSITY",
      "BEHAVIORAL"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-139",
    "canonical_text": "Why do you want to come here?",
    "revision": 1,
    "source": "mr142",
    "source_number": 139,
    "tags": [
      "PROGRAM_FIT",
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-140",
    "canonical_text": "What are some challenges that will face this specialty?",
    "revision": 1,
    "source": "mr142",
    "source_number": 140,
    "tags": [
      "SPECIALTY",
      "HEALTHCARE_POLICY"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-141",
    "canonical_text": "What motivates you?",
    "revision": 1,
    "source": "mr142",
    "source_number": 141,
    "tags": [
      "MOTIVATION"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "MR142-142",
    "canonical_text": "Why are you here?",
    "revision": 1,
    "source": "mr142",
    "source_number": 142,
    "tags": [
      "MOTIVATION",
      "PROGRAM_FIT"
    ],
    "style": [
      "traditional"
    ],
    "difficulty": 1,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": false,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-001",
    "canonical_text": "Describe a clinical situation you handled well.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 1,
    "tags": [
      "BEHAVIORAL",
      "CLINICAL_EXPERIENCE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-002",
    "canonical_text": "Tell me about a clinical situation that didn't go as well as you would have liked.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 2,
    "tags": [
      "BEHAVIORAL",
      "CLINICAL_EXPERIENCE",
      "FAILURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-003",
    "canonical_text": "Give me an example of a time when you had a difficult communication problem.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 3,
    "tags": [
      "BEHAVIORAL",
      "COMMUNICATION"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-004",
    "canonical_text": "Tell me about a time you had to build a relationship with someone you didn't like.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 4,
    "tags": [
      "BEHAVIORAL",
      "TEAMWORK",
      "CONFLICT"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-005",
    "canonical_text": "Tell me about a problem you had with a classmate, faculty member or patient. How would you handle it?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 5,
    "tags": [
      "BEHAVIORAL",
      "CONFLICT"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-006",
    "canonical_text": "Tell me about a time when you handled a stressful situation poorly.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 6,
    "tags": [
      "BEHAVIORAL",
      "STRESS_PRESSURE",
      "FAILURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-007",
    "canonical_text": "Tell me about a problem you became really angry over a situation at work. [sic]",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 7,
    "tags": [
      "BEHAVIORAL",
      "CONFLICT",
      "STRESS_PRESSURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-008",
    "canonical_text": "Discuss a particularly difficult experience in your medical training.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 8,
    "tags": [
      "BEHAVIORAL",
      "ADVERSITY",
      "CLINICAL_EXPERIENCE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-009",
    "canonical_text": "Describe to me a situation in which you had to break someone's confidence.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 9,
    "tags": [
      "BEHAVIORAL",
      "ETHICS"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-010",
    "canonical_text": "Was there a time when you witness unprofessional or unethical behavior on the part of a resident or attending? How did you handle it? [sic]",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 10,
    "tags": [
      "BEHAVIORAL",
      "ETHICS",
      "RED_FLAGS"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-011",
    "canonical_text": "Tell me about a time when you had to build rapport quickly with someone under difficult conditions.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 11,
    "tags": [
      "BEHAVIORAL",
      "COMMUNICATION",
      "PATIENT_INTERACTION"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-012",
    "canonical_text": "Tell me about the major challenges you have faced in your medical school career.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 12,
    "tags": [
      "BEHAVIORAL",
      "ADVERSITY"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-013",
    "canonical_text": "Tell me about a time you were able to successfully work with another person even when that person may not have personally liked you.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 13,
    "tags": [
      "BEHAVIORAL",
      "TEAMWORK"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-014",
    "canonical_text": "Tell me about a time when you were able to successfully work with another person when you did not personally like that person.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 14,
    "tags": [
      "BEHAVIORAL",
      "TEAMWORK"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-015",
    "canonical_text": "Tell me about a time during rotations in which you went above and beyond.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 15,
    "tags": [
      "BEHAVIORAL",
      "CLINICAL_EXPERIENCE",
      "STRENGTHS"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-016",
    "canonical_text": "Describe to me a time when you received an evaluation with which you disagreed.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 16,
    "tags": [
      "BEHAVIORAL",
      "CONFLICT",
      "COMMUNICATION"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-017",
    "canonical_text": "Your senior resident insists on a treatment plan you feel may harm the patient.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 17,
    "tags": [
      "BEHAVIORAL",
      "ETHICS",
      "MISTAKE_SAFETY",
      "SITUATIONAL"
    ],
    "style": [
      "behavioral",
      "situational"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-018",
    "canonical_text": "Describe a difficult time in your life and how you dealt with it.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 18,
    "tags": [
      "BEHAVIORAL",
      "ADVERSITY"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-019",
    "canonical_text": "Do you have any beliefs or convictions that might interfere with your willingness to deal with the kind of clinical situations you are likely to be presented with in residency training?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 19,
    "tags": [
      "BEHAVIORAL",
      "ETHICS",
      "RED_FLAGS"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-020",
    "canonical_text": "Describe the most difficult decision you have ever had to make. How did you go about it?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 20,
    "tags": [
      "BEHAVIORAL",
      "SITUATIONAL",
      "ADVERSITY"
    ],
    "style": [
      "behavioral",
      "situational"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-021",
    "canonical_text": "Tell me about the latest treatment for X (a common disease treated by the specialty).",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 21,
    "tags": [
      "BEHAVIORAL",
      "CLINICAL_EXPERIENCE",
      "STRESS_PRESSURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-022",
    "canonical_text": "What was the hardest thing that you have ever had to do?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 22,
    "tags": [
      "BEHAVIORAL",
      "ADVERSITY"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-023",
    "canonical_text": "If you had a rack full of cases, what type of case would you want to pick up?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 23,
    "tags": [
      "BEHAVIORAL",
      "SPECIALTY",
      "CLINICAL_EXPERIENCE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-024",
    "canonical_text": "Tell me about a time when you worked effectively under a great deal of pressure.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 24,
    "tags": [
      "BEHAVIORAL",
      "STRESS_PRESSURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-025",
    "canonical_text": "How do you deal with stress and how would someone tell you are stressed out?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 25,
    "tags": [
      "BEHAVIORAL",
      "STRESS_PRESSURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-026",
    "canonical_text": "Tell me about particularly stressful situation you encountered in medical school and how you handled it. [sic]",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 26,
    "tags": [
      "BEHAVIORAL",
      "STRESS_PRESSURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-027",
    "canonical_text": "Tell me about time when you make a mistake and had to admit it to your resident or attending. [sic]",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 27,
    "tags": [
      "BEHAVIORAL",
      "MISTAKE_SAFETY",
      "FAILURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-028",
    "canonical_text": "Tell me about a time when you failed. What did you learn from it?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 28,
    "tags": [
      "BEHAVIORAL",
      "FAILURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-029",
    "canonical_text": "Name a mistake you made and corrected it before being caught.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 29,
    "tags": [
      "BEHAVIORAL",
      "MISTAKE_SAFETY",
      "ETHICS"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-030",
    "canonical_text": "How would you deal with fellow resident who is not doing his share of the work? [sic]",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 30,
    "tags": [
      "BEHAVIORAL",
      "TEAMWORK",
      "CONFLICT",
      "SITUATIONAL"
    ],
    "style": [
      "behavioral",
      "situational"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-031",
    "canonical_text": "Tell me about a negative interaction you had with an attending or resident. How did the two of you deal with it?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 31,
    "tags": [
      "BEHAVIORAL",
      "CONFLICT"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-032",
    "canonical_text": "Tell me about a time when you were really upset by the words or action of an attending or resident.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 32,
    "tags": [
      "BEHAVIORAL",
      "CONFLICT",
      "STRESS_PRESSURE"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-033",
    "canonical_text": "Tell me about a patient from whom you learned something. How will this experience help you as a physician?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 33,
    "tags": [
      "BEHAVIORAL",
      "PATIENT_INTERACTION"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-034",
    "canonical_text": "Tell me about a time you had to work with someone you disliked or did not get along with.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 34,
    "tags": [
      "BEHAVIORAL",
      "TEAMWORK",
      "CONFLICT"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-035",
    "canonical_text": "Describe a relationship with a patient that had significant effect on you. [sic]",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 35,
    "tags": [
      "BEHAVIORAL",
      "PATIENT_INTERACTION"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-036",
    "canonical_text": "Tell me about a time when you had personally conflict with another team member. How did you deal with it? [sic]",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 36,
    "tags": [
      "BEHAVIORAL",
      "CONFLICT",
      "TEAMWORK"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-037",
    "canonical_text": "Your attending physician ask you a question and you are not sure of the answer? What do you say? [sic]",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 37,
    "tags": [
      "BEHAVIORAL",
      "SITUATIONAL",
      "COMMUNICATION"
    ],
    "style": [
      "behavioral",
      "situational"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": true,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-038",
    "canonical_text": "Your colleague is abusing alcohol or drugs. How would you handle the situation?",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 38,
    "tags": [
      "BEHAVIORAL",
      "ETHICS",
      "RED_FLAGS",
      "SITUATIONAL"
    ],
    "style": [
      "behavioral",
      "situational"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-039",
    "canonical_text": "Tell me about a time when you were disappointed in your performance.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 39,
    "tags": [
      "BEHAVIORAL",
      "FAILURE",
      "PERSONAL"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-040",
    "canonical_text": "Tell me about a time when you disagreed with how an ethical situation was being handled.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 40,
    "tags": [
      "BEHAVIORAL",
      "ETHICS",
      "CONFLICT"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 3,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  },
  {
    "question_id": "BEH-041",
    "canonical_text": "Tell me about a situation in which you overcame adversity.",
    "revision": 1,
    "source": "mr_behavioral",
    "source_number": 41,
    "tags": [
      "BEHAVIORAL",
      "ADVERSITY"
    ],
    "style": [
      "behavioral"
    ],
    "difficulty": 2,
    "difficulty_origin": "import_seed_heuristic",
    "core_priority": false,
    "specialties": [],
    "cv_relevance": false,
    "behavioral": true,
    "followup_eligible": true,
    "verbatim_sic": false,
    "assets": {
      "kelly": "none",
      "woods": "none"
    },
    "links": [],
    "provenance": {
      "manifest": "Y1-Y2-CAM-V6-3494A_MVP_QUESTION_IMPORT_MANIFEST.md"
    }
  }
].map(Object.freeze));
