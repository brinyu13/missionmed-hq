/* Frozen 3528B question corpus and user calibration defaults.
   Sessions, identity, analytics and media are supplied by the real runtime. */

/* -- curated interview question corpus ------------------------- */
export const CATEGORIES = [
  { id: 'behavioral', label: 'Behavioral', icon: 'M4 17l5-10 4 7 3-4 4 7', color: '#39d6ff' },
  { id: 'motivation', label: 'Motivation', icon: 'M12 3l2.6 5.9 6.4.6-4.8 4.2 1.4 6.3L12 16.8 6.4 20l1.4-6.3L3 9.5l6.4-.6z', color: '#ffc24b' },
  { id: 'teamwork', label: 'Teamwork', icon: 'M7 10a3 3 0 100-6 3 3 0 000 6zm10 0a3 3 0 100-6 3 3 0 000 6zM2 20c0-3 2.5-5 5-5s5 2 5 5m0 0c0-3 2.5-5 5-5s5 2 5 5', color: '#2fe7b0' },
  { id: 'ethics', label: 'Ethics', icon: 'M12 3v18M5 7h14M7 7l-3 6a4 4 0 006 0zM17 7l-3 6a4 4 0 006 0z', color: '#a696ff' },
  { id: 'resilience', label: 'Resilience', icon: 'M4 14c2-6 6-9 8-9s6 3 8 9m-13 2a3 3 0 106 0 3 3 0 10-6 0', color: '#ff8d5e' },
  { id: 'fit', label: 'Program Fit', icon: 'M12 21s-7-4.6-9-9a5.2 5.2 0 019-4 5.2 5.2 0 019 4c-2 4.4-9 9-9 9z', color: '#ff6f91' },
  { id: 'self', label: 'Self-Assessment', icon: 'M12 13a4 4 0 100-8 4 4 0 000 8zm-7 8a7 7 0 0114 0M17 3l2 2-2 2', color: '#7fd0ff' },
];

export const QUESTIONS = [
  { id: 'q1', cat: 'behavioral', text: 'Tell me about a time you handled a difficult patient situation.', diff: 2, fav: true },
  { id: 'q2', cat: 'behavioral', text: 'Describe a time you received difficult feedback. What did you do?', diff: 2, fav: false },
  { id: 'q3', cat: 'behavioral', text: 'Tell me about a mistake you made in a clinical setting.', diff: 3, fav: false },
  { id: 'q4', cat: 'motivation', text: 'Why this specialty?', diff: 1, fav: true },
  { id: 'q5', cat: 'motivation', text: 'Where do you see your career in ten years?', diff: 1, fav: false },
  { id: 'q6', cat: 'teamwork', text: 'What would your team say about you?', diff: 1, fav: false },
  { id: 'q7', cat: 'teamwork', text: 'Describe a conflict with a colleague and how you resolved it.', diff: 2, fav: false },
  { id: 'q8', cat: 'ethics', text: 'A colleague appears impaired on shift. What do you do?', diff: 3, fav: true },
  { id: 'q9', cat: 'ethics', text: 'A patient refuses a life-saving intervention. Walk me through your thinking.', diff: 3, fav: false },
  { id: 'q10', cat: 'resilience', text: 'Tell me about a failure and what you learned.', diff: 2, fav: false },
  { id: 'q11', cat: 'resilience', text: 'How do you handle the emotional weight of medicine?', diff: 2, fav: false },
  { id: 'q12', cat: 'fit', text: 'Why our program?', diff: 1, fav: false },
  { id: 'q13', cat: 'fit', text: 'What will you contribute to our residency community?', diff: 2, fav: false },
  { id: 'q14', cat: 'self', text: 'What are your greatest strengths and weaknesses?', diff: 1, fav: false },
  { id: 'q15', cat: 'self', text: 'Teach me something in two minutes.', diff: 3, fav: false },
];

export const CALIBRATION = {
  paceCorridor: [140, 175],
  volumeCorridorLu: [-6, 6],
  gestureCorridor: [6, 14],
};
