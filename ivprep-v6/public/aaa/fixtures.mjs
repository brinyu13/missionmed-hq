export const QUESTION_CATEGORIES = [
  "Opening",
  "Clinical",
  "Behavioral",
  "Program fit",
  "Application",
  "Pressure"
];

export const QUESTIONS = [
  {
    id: "tell-me-about-yourself",
    category: "Opening",
    prompt: "Tell me about yourself, and what brought you to internal medicine.",
    why: "Sets your narrative and the interviewer's first impression.",
    minutes: 2,
    profile: true
  },
  {
    id: "clinical-judgment",
    category: "Clinical",
    prompt: "Tell me about a time your clinical judgment changed a patient's course.",
    why: "Tests ownership, reasoning, and a clear outcome.",
    minutes: 3,
    profile: false
  },
  {
    id: "conflict",
    category: "Behavioral",
    prompt: "Describe a conflict on a care team and how you handled it.",
    why: "Surfaces teamwork without asking you to perform a personality type.",
    minutes: 3,
    profile: false
  },
  {
    id: "why-program",
    category: "Program fit",
    prompt: "Why is Riverside University the right place for your next stage of training?",
    why: "Connects your goals to specific, sourced program facts.",
    minutes: 2,
    profile: true
  },
  {
    id: "gap-transition",
    category: "Application",
    prompt: "Walk me through the eight-month transition before your U.S. clinical experience.",
    why: "Practices a factual, forward-looking explanation.",
    minutes: 2,
    profile: true
  },
  {
    id: "research-contribution",
    category: "Application",
    prompt: "What was your personal contribution to the sepsis research project?",
    why: "Separates your role, method, result, and learning.",
    minutes: 3,
    profile: true
  },
  {
    id: "specialty-transition",
    category: "Application",
    prompt: "What drove your transition from surgery toward internal medicine?",
    why: "Makes the intellectual transition as clear as the chronology.",
    minutes: 2,
    profile: true
  },
  {
    id: "failure",
    category: "Pressure",
    prompt: "Tell me about a meaningful failure. What changed afterward?",
    why: "Tests reflection through observable decisions and actions.",
    minutes: 3,
    profile: false
  },
  {
    id: "why-you",
    category: "Pressure",
    prompt: "What would you add to this residency class that we do not already have?",
    why: "Invites a concise, evidence-backed value proposition.",
    minutes: 2,
    profile: false
  },
  {
    id: "questions-for-us",
    category: "Program fit",
    prompt: "What questions do you have for us?",
    why: "Rehearses a close that demonstrates genuine program understanding.",
    minutes: 2,
    profile: false
  }
];

export const VAULT_SESSIONS = [
  {
    id: "riverside-2026-08-09",
    date: "Yesterday",
    title: "Riverside University · Full interview",
    type: "Customized",
    interviewer: "Dr. Marcus Hale",
    duration: "14:32",
    status: "Mentor reviewed",
    questions: 6,
    highlight: "Direct clinical transition",
    transcript: [
      { time: "0:42", text: "I grew up in a home where service was ordinary, and medicine made that instinct concrete." },
      { time: "4:18", text: "During my medicine rotation, I noticed the patient was deteriorating before the numbers made it obvious." },
      { time: "11:03", text: "I want a program that expects ownership and still feels like a professional home." }
    ]
  },
  {
    id: "behavioral-2026-08-06",
    date: "Aug 6",
    title: "Behavioral pressure set",
    type: "Instant",
    interviewer: "Dr. Naomi Chen",
    duration: "09:48",
    status: "Self-reviewed",
    questions: 4,
    highlight: "Conflict story needs a shorter setup",
    transcript: [
      { time: "2:14", text: "The disagreement was about whether home discharge was safe before the weekend." },
      { time: "7:02", text: "I learned to make the shared clinical goal explicit before debating tactics." }
    ]
  },
  {
    id: "north-harbor-2026-08-03",
    date: "Aug 3",
    title: "North Harbor · Program fit",
    type: "Customized",
    interviewer: "Dr. Priya Raman",
    duration: "08:10",
    status: "Review requested",
    questions: 3,
    highlight: "Program-specific closing question",
    transcript: [
      { time: "1:08", text: "North Harbor feels like a home for the kind of clinician-educator I want to become." },
      { time: "6:29", text: "How do residents turn quality-improvement ideas into projects with durable ownership?" }
    ]
  }
];

export const DEBRIEF_FOLLOWUPS = [
  {
    topic: "Arrival / login",
    prompt: "Who did you meet first, and what did they tell you about the day?"
  },
  {
    topic: "Interviewers",
    prompt: "Who interviewed you first? Share a name or role only if you remember it."
  },
  {
    topic: "Questions",
    prompt: "What was the first question you can remember? Exact wording is not required."
  },
  {
    topic: "Stories used",
    prompt: "Which example or story did you use, and what part seemed to interest them?"
  },
  {
    topic: "Your questions",
    prompt: "What did you ask them? What did their answer add or change?"
  },
  {
    topic: "Closing",
    prompt: "How did the conversation end? Capture only what you actually remember."
  },
  {
    topic: "Overall impression",
    prompt: "What is one concrete detail you want to remember before ranking?"
  }
];

export const PLAYBOOK_TOPICS = [
  {
    id: "arrival",
    name: "Arrival and orientation",
    prompt: "Who did you meet first, and what did they tell you about the day?",
    enabled: true
  },
  {
    id: "interviewers",
    name: "Interviewer identities",
    prompt: "Who interviewed you? Capture names or roles only when remembered.",
    enabled: true
  },
  {
    id: "questions",
    name: "Questions asked",
    prompt: "What questions can you reconstruct without inventing exact wording?",
    enabled: true
  },
  {
    id: "stories",
    name: "Stories used",
    prompt: "Which examples did you use, and where did the interviewer follow up?",
    enabled: true
  },
  {
    id: "closing",
    name: "Closing and follow-up",
    prompt: "How did it end, and was any next step stated?",
    enabled: true
  }
];
