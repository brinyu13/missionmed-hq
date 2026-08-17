export const VAULT_SESSIONS = [];

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
