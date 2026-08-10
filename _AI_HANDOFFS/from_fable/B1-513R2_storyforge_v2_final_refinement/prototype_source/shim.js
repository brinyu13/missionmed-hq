/*
 * B1-513 STORYFORGE STAGE 2 WORKING PROTOTYPE — RUNTIME SHIM + SYNTHETIC BACKEND
 * =============================================================================
 * PROTOTYPE-ONLY. This script exists so the EXACT production StoryForge renderer
 * can run standalone (file://) for Founder product review:
 *   1. A fetch interceptor serves an in-memory synthetic StoryForge API.
 *   2. history.pushState/replaceState are guarded for file:// origins.
 *   3. navigator.mediaDevices.getUserMedia returns a synthetic silent audio
 *      stream so the real production recorder UI can run without a microphone.
 *   4. All data is SYNTHETIC. No production endpoint is called, no real student
 *      content, secrets, or tokens exist anywhere in this file.
 * Nothing in this shim is proposed production behavior. The production
 * contracts these endpoints demonstrate are specified in the B1-513
 * architecture package.
 */
(function b1513Shim() {
  'use strict';

  /* ---------- origin + history guards (file:// support) ---------- */
  const SAFE_ORIGIN = (window.location.origin && window.location.origin !== 'null')
    ? window.location.origin
    : 'https://storyforge-prototype.local';
  window.__B1513_ORIGIN = SAFE_ORIGIN;

  const realPush = history.pushState.bind(history);
  const realReplace = history.replaceState.bind(history);
  history.pushState = function guardedPush(...args) {
    try { return realPush(...args); } catch { /* file:// cannot change path — in-memory routing continues */ }
  };
  history.replaceState = function guardedReplace(...args) {
    try { return realReplace(...args); } catch { /* same */ }
  };

  /* ---------- synthetic microphone ---------- */
  let synthStream = null;
  const realGetUserMedia = navigator.mediaDevices?.getUserMedia?.bind(navigator.mediaDevices);
  if (navigator.mediaDevices) {
    navigator.mediaDevices.getUserMedia = async (constraints) => {
      if (realGetUserMedia) {
        try { return await realGetUserMedia(constraints); } catch { /* fall through to synthetic */ }
      }
      if (!synthStream || !synthStream.active) {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        gain.gain.value = 0.0001; // effectively silent
        const dest = ctx.createMediaStreamDestination();
        osc.connect(gain).connect(dest);
        osc.start();
        synthStream = dest.stream;
      }
      return synthStream;
    };
  }

  /* ---------- tiny WAV generator for simulated original audio ---------- */
  function makeToneWavBlob(seconds = 8) {
    const rate = 8000;
    const samples = Math.floor(rate * seconds);
    const buffer = new ArrayBuffer(44 + samples);
    const view = new DataView(buffer);
    const writeStr = (offset, str) => { for (let i = 0; i < str.length; i += 1) view.setUint8(offset + i, str.charCodeAt(i)); };
    writeStr(0, 'RIFF'); view.setUint32(4, 36 + samples, true); writeStr(8, 'WAVE');
    writeStr(12, 'fmt '); view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate, true); view.setUint16(32, 1, true); view.setUint16(34, 8, true);
    writeStr(36, 'data'); view.setUint32(40, samples, true);
    for (let i = 0; i < samples; i += 1) {
      const t = i / rate;
      const f = 160 + 40 * Math.sin(t * 0.9) + 20 * Math.sin(t * 2.3);
      const v = Math.sin(2 * Math.PI * f * t) * 0.22 * (0.6 + 0.4 * Math.sin(t * 0.5));
      view.setUint8(44 + i, Math.round((v + 1) * 127.5));
    }
    return new Blob([buffer], { type: 'audio/wav' });
  }
  const AUDIO_SECONDS = 9;
  let toneUrl = null;
  function audioUrl() {
    if (!toneUrl) toneUrl = URL.createObjectURL(makeToneWavBlob(AUDIO_SECONDS));
    return toneUrl;
  }

  /* ================================================================
   * SYNTHETIC DATASET (all fictional)
   * ================================================================ */
  const NOW = Date.now();
  const days = (n) => new Date(NOW - n * 86400000).toISOString();
  const hours = (n) => new Date(NOW - n * 3600000).toISOString();
  const AUDIO_MS = AUDIO_SECONDS * 1000;
  const ACTIVITY_FROM = days(0); // activity tracking "enabled" today — truthful boundary demo

  const PROMPT_LIBRARY = /* __B1513_PROMPT_LIBRARY__ */ null;

  const CONSENT_POLICY = {
    version: 'mentorship-visibility-1',
    title: 'StoryForge is part of MissionMed mentorship',
    updated: '2026-08-07',
    body: [
      'StoryForge is your private story workspace inside MissionMed mentorship. Your authorized MissionMed mentor (Dr Brian) may look at mentor-visible work to guide you — the way a coach reviews practice film — even before you formally submit a story for review.',
      'After you agree, new stories start as Mentor Visible. You stay in control: any individual story can be switched to Private — visible only to me at any time, and Private stories are never opened, listed, or reviewed by anyone but you.',
      'Submitting a story is still a separate, explicit action that means “please review this story now.”',
      'Nothing here is ever public. Other students can never see your work. Every visibility change is logged to your story history, and you can re-read this policy any time in Settings.',
    ],
    facts: [
      'New stories default to Mentor Visible after you agree',
      'Any story can be made Private — visible only to me',
      'Private stories are not reviewed and cannot be opened by mentors',
      'Stories you created before today stay Private until you choose otherwise',
      'Nothing is public; other students never see your stories',
      'Visibility changes are logged; the policy is always available in Settings',
    ],
  };

  const b1513Presentation = () => ({
    versions: [
      { key: 'full_story', label: 'Full Story', state: 'active', sortOrder: 10, helper: 'Your complete, comprehensive telling — the same editable working version you already know. The Original telling stays untouched, always.', target: 'No length limit — capture everything that matters.' },
      { key: 'thirty_second', label: '30-Second Version', state: 'active', sortOrder: 20, helper: 'A concise interview-ready telling. Say it out loud — if it runs past thirty seconds, trim until it lands.', target: 'Aim for ~75–90 spoken words (≈30 seconds).' },
      { key: 'nnq_setup', label: 'NNQ Setup Version', state: 'active', sortOrder: 30, helper: 'Shaped for MissionMed’s Next Natural Questions method: end this telling so the interviewer’s next question is one you have already prepared.', target: 'Aim for ~60–120 words. Finish on a door you want opened.' },
    ],
    inspiration: { enabled: true },
  });

  function presentationPayload() {
    return {
      taxonomy: db.contentDisplay.taxonomy,
      sections: db.contentDisplay.sections,
      navigation: db.contentDisplay.navigation,
      b1513: db.contentDisplay.b1513,
    };
  }

  const DEFAULT_SECTIONS = {
    storyCategories: { title: 'Story categories', helper: 'Categories describe what happened. They stay separate from themes and intended uses.', mode: 'visible_optional' },
    intendedUses: { title: 'Where this story could be used', helper: 'Choose every application context where this story may help.', mode: 'visible_optional' },
    workingVersion: { title: 'Full Story', helper: 'Your complete telling — edit freely here. The original telling stays untouched, always.', mode: 'visible_optional' },
    learningLesson: { title: 'Learning Lesson', helper: 'What this story taught you — the takeaway that travels with it.', mode: 'visible_optional' },
    reviewSubmission: { title: 'Submit for review', helper: 'Submitting asks your mentor to review this story now. Visibility is separate — see the Visibility card above.', mode: 'visible_optional' },
  };
  const DEFAULT_TAXONOMY = {
    categories: [
      ['clinical', 'Clinical'], ['personal', 'Personal'], ['research', 'Research'], ['leadership', 'Leadership'],
      ['teaching', 'Teaching'], ['volunteer_service', 'Volunteer / Service'], ['adversity_challenge', 'Adversity / Challenge'],
      ['teamwork', 'Teamwork'], ['communication', 'Communication'], ['ethics_professionalism', 'Ethics / Professionalism'], ['other', 'Other'],
    ].map(([id, label], i) => ({ id, label, sortOrder: (i + 1) * 10, state: 'active', builtin: true })),
    intendedUses: [
      ['ps', 'Personal Statement'], ['iv', 'Interview Set'], ['letter', 'Letter of Recommendation'],
      ['myeras_experiences', 'MyERAS Experiences'], ['myeras_most_impactful', 'MyERAS Most Impactful'], ['later', 'Someday / Fellowship'],
    ].map(([id, label], i) => ({ id, label, sortOrder: (i + 1) * 10, state: 'active', builtin: true })),
  };

  /* ---------- users ---------- */
  const USERS = {
    founderStudent: {
      user: { id: 'u-founder', wp_user_id: 1, username: 'brinyu', display_name: 'Dr Brian', first_name: 'Brian', role: 'student', cohort: 'MissionMed 360', background_preference: 'ember', reading_size_preference: 'standard' },
      capabilities: { voiceCapture: true, adminConsole: true, submissionReview: true, taxonomy: true, inlinePriority: true, storySearch: true, mentorNotes: true, mentorNotesRead: true, storyMedia: false },
      consent: { accepted: true, policyVersion: CONSENT_POLICY.version, acceptedAt: days(0.2), auditId: 'consent-a-0001' },
    },
    student: {
      user: { id: 'u-maya', wp_user_id: 2201, username: 'maya.osei', display_name: 'Maya Osei', first_name: 'Maya', role: 'student', cohort: 'MissionMed 360', background_preference: 'aurora', reading_size_preference: 'standard' },
      capabilities: { voiceCapture: true, adminConsole: false, submissionReview: true, taxonomy: true, inlinePriority: true, storySearch: true, mentorNotes: false, mentorNotesRead: true, storyMedia: false },
      consent: { accepted: false },
    },
    studentOther: {
      user: { id: 'u-second', wp_user_id: 2202, username: 'jonas.wirth', display_name: 'Jonas Wirth', first_name: 'Jonas', role: 'student', cohort: 'MissionMed 360', background_preference: 'ember', reading_size_preference: 'large' },
      capabilities: { voiceCapture: true, adminConsole: false, submissionReview: true, taxonomy: true, inlinePriority: true, storySearch: true, mentorNotes: false, mentorNotesRead: true, storyMedia: false },
      consent: { accepted: true, policyVersion: CONSENT_POLICY.version, acceptedAt: days(1), auditId: 'consent-a-0002' },
    },
    mentor: {
      user: { id: 'u-mentor', wp_user_id: 900, username: 'dr.chen', display_name: 'Dr. Chen', first_name: 'Sarah', role: 'mentor', cohort: '', background_preference: 'ember', reading_size_preference: 'standard' },
      capabilities: { voiceCapture: false, adminConsole: false, submissionReview: true, taxonomy: true, inlinePriority: false, storySearch: true, mentorNotes: true, mentorNotesRead: true, storyMedia: false },
      consent: { accepted: true, policyVersion: CONSENT_POLICY.version, acceptedAt: days(2), auditId: 'consent-a-0003' },
    },
    admin: {
      user: { id: 'u-admin', wp_user_id: 107, username: 'Brian_test', display_name: 'Brian Test', first_name: 'Brian', role: 'admin', cohort: '', background_preference: 'static', reading_size_preference: 'standard' },
      capabilities: { voiceCapture: false, adminConsole: true, submissionReview: true, taxonomy: true, inlinePriority: false, storySearch: true, mentorNotes: true, mentorNotesRead: true, storyMedia: false },
      consent: { accepted: true, policyVersion: CONSENT_POLICY.version, acceptedAt: days(2), auditId: 'consent-a-0004' },
    },
  };
  USERS.mentorTwo = { ...USERS.mentor, user: { ...USERS.mentor.user, id: 'u-mentor2', display_name: 'Dr. Rivera', first_name: 'Ana', username: 'dr.rivera' } };
  USERS.unassignedMentor = { ...USERS.mentor, user: { ...USERS.mentor.user, id: 'u-mentor3', display_name: 'Dr. Ito', first_name: 'Ken', username: 'dr.ito' }, capabilities: { ...USERS.mentor.capabilities, mentorNotes: false } };

  /* ---------- stories ---------- */
  function hist(at, actor, action, detail) {
    return { created_at: at, actor_display: actor, action, detail };
  }
  function ver(body, updatedAt, source, revisions = []) {
    return { body, updatedAt, createdAt: updatedAt, source, rowVersion: revisions.length + 1, revisions };
  }

  const STORIES = [
    {
      id: 's-101', studentId: 'u-founder', studentName: 'Dr Brian',
      title: 'the Code Cart Wouldn’t Open', prefixEnabled: true,
      originalTitle: 'the Code Cart Wouldn’t Open',
      originalText: 'It was my third week in the ICU and the code cart drawer jammed during a real arrest. I remember my hands shaking, and the respiratory therapist just looked at me and said, calmly, "second drawer sticks — lift, then pull." We got it open, the patient made it, and afterward I taped a handwritten note to that drawer. The next month the note was laminated. Somebody had decided it mattered.',
      text: 'It was my third week in the ICU and the code cart drawer jammed in the middle of a real arrest. My hands were shaking. The respiratory therapist — twenty years on that unit — looked at me and said, calmly, “second drawer sticks — lift, then pull.” We got it open. The patient survived. Afterward I taped a handwritten note to that drawer so the next shaking pair of hands wouldn’t lose those seconds. A month later my note had been laminated: somebody I never met decided it mattered. I think about that laminate more than the arrest. Systems remember what people write down.',
      lesson: 'Small fixes outlive big moments — write the note the next person needs.',
      status: 'approved', revised: false, studentScore: 5, mentorScore: 5, reviewSuitability: 'both',
      studentStar: true, mentorStar: true, themes: ['team'], categories: ['clinical', 'teamwork'], uses: ['iv', 'myeras_most_impactful'],
      birds: ['owl'], positions: ['pd'], rowVersion: 9, captureType: 'audio',
      createdAt: days(24), updatedAt: days(2), submittedAt: days(20), openedAt: days(19), reviewedAt: days(18),
      statusChangedAt: days(18), feedbackSentAt: days(18), reviewedByName: 'Dr Brian', reviewedByRole: 'admin',
      audio: { id: 'aud-101', durationMs: AUDIO_MS }, audioAssetId: 'aud-101', audioDurationMs: AUDIO_MS,
      visibility: 'mentor_visible', visibilityChangedAt: days(20), origin: { type: 'capture' },
      versions: {
        thirty_second: ver('Third week in the ICU, a code cart drawer jammed during a real arrest. A veteran RT taught me the fix in five calm words. The patient survived — and I taped a note to that drawer so the next person wouldn’t lose those seconds. It got laminated. Small fixes outlive big moments.', days(3), 'typed', [
          { id: 'rev-101-30-1', body: 'ICU, week three, code cart jammed mid-arrest. RT saved us with five calm words. I taped a note to the drawer; someone laminated it.', savedAt: days(6), source: 'typed' },
        ]),
        nnq_setup: ver('In my third week in the ICU a code cart drawer jammed during an arrest. A veteran respiratory therapist walked me through it in five calm words, and afterward I taped a fix-it note to the drawer — which someone quietly laminated. That note changed how I think about safety: the strongest systems are the ones that remember what individuals learn.', days(3), 'typed'),
      },
      feedback: [{ body: 'This is your strongest interview story. The laminated note is the detail that makes it yours — keep it in every version.', author_name: 'Dr Brian', created_at: days(18) }],
      mentorNotes: [
        { id: 'mn-1', story_id: 's-101', body: 'Beautiful arc. For the 30-second cut, land on the laminated note, not the arrest. Practice it out loud twice.', state: 'published', internalOnly: false, authorName: 'Dr Brian', createdAt: days(18), publishedAt: days(18), hasAudio: true, audioAssetId: 'mn-aud-1' },
        { id: 'mn-2', story_id: 's-101', body: 'Internal: candidate anchor story for PD-style interviews.', state: 'published', internalOnly: true, authorName: 'Dr Brian', createdAt: days(18), publishedAt: days(18) },
      ],
      media: [], revisions: [], reflections: [], mappings: [], questionCount: 2, useSuggestions: [],
      history: [
        hist(days(24), 'Dr Brian', 'story.captured', 'from a voice note'),
        hist(days(20), 'Dr Brian', 'story.submitted', ''),
        hist(days(20), 'Dr Brian', 'story.visibility_changed', 'to Mentor Visible'),
        hist(days(18), 'Dr Brian', 'story.status_changed', 'to Approved'),
        hist(days(6), 'Dr Brian', 'story.version_edited', '30-Second Version'),
        hist(days(3), 'Dr Brian', 'story.version_edited', 'NNQ Setup Version'),
      ],
    },
    {
      id: 's-102', studentId: 'u-founder', studentName: 'Dr Brian',
      title: 'I Taught My Grandmother to Read Lab Results', prefixEnabled: true,
      originalTitle: 'I Taught My Grandmother to Read Lab Results',
      originalText: 'My grandmother kept a folder of every lab result she had ever been handed, and she understood none of them. One Sunday she slid the folder across the table and asked me to translate. We spent the afternoon drawing kidneys on napkins. By the end she was explaining creatinine to my uncle.',
      text: 'My grandmother kept a folder of every lab result she had ever been handed — years of them, in perfect order, understood by no one. One Sunday she slid the folder across the table and asked me, quietly, to translate. We spent the whole afternoon drawing kidneys on napkins and turning numbers into sentences. By the end she was explaining creatinine to my uncle with my napkin as her slide. Teaching her taught me what patients actually do with the words we hand them: they keep them, they carry them, and they wait for someone to make them mean something.',
      lesson: 'Patients keep every word we give them — make the words mean something.',
      status: 'awaiting', revised: false, studentScore: 4, mentorScore: 0, reviewSuitability: '',
      studentStar: false, mentorStar: false, themes: ['comm'], categories: ['personal', 'teaching', 'communication'], uses: ['ps'],
      birds: ['dove'], positions: ['faculty'], rowVersion: 4, captureType: 'text',
      createdAt: days(9), updatedAt: days(1), submittedAt: hours(20), statusChangedAt: hours(20),
      audio: null, audioAssetId: '', audioDurationMs: 0,
      visibility: 'mentor_visible', visibilityChangedAt: days(9),
      origin: { type: 'inspiration', promptId: 'q-046', promptText: "When you were growing up, how did schoolwork actually get done in your house \u2014 alone at a kitchen table, next to a sibling, squeezed around chores or a job? Take me to one specific evening." },
      versions: {
        thirty_second: ver('My grandmother kept every lab result she’d ever been handed and understood none of them. One Sunday she asked me to translate, and we spent the afternoon drawing kidneys on napkins. By the end she was teaching my uncle. That afternoon is why I explain everything twice — patients keep our words.', days(1), 'voice'),
      },
      feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 1, useSuggestions: [],
      history: [
        hist(days(9), 'Dr Brian', 'story.captured', 'from Inspiration — “When you were growing up, how did schoolwork actually get done in your house…”'),
        hist(days(1), 'Dr Brian', 'story.version_edited', '30-Second Version (voice — Append)'),
        hist(hours(20), 'Dr Brian', 'story.submitted', ''),
      ],
    },
    {
      id: 's-103', studentId: 'u-founder', studentName: 'Dr Brian',
      title: 'the Night Shift Sang', prefixEnabled: true,
      originalTitle: 'the Night Shift Sang',
      originalText: 'At 3 a.m. on a brutal night shift, the charge nurse started humming. By 3:15 half the unit was quietly singing with her while we restocked. The patients slept. It fixed nothing and it fixed everything.',
      text: 'At 3 a.m. on a brutal night shift — two admissions, one rapid response, everyone running on vending-machine coffee — the charge nurse started humming while she restocked the supply cart. By 3:15 half the unit was quietly singing with her. Nothing about the workload changed. Everything about the shift did. I learned that morale is a clinical intervention, and that the people who deliver it are rarely the ones with the longest titles.',
      lesson: 'Morale is a clinical intervention — and anyone can prescribe it.',
      status: 'in_review', revised: false, studentScore: 3, mentorScore: 0, reviewSuitability: '',
      studentStar: false, mentorStar: false, themes: ['team'], categories: ['clinical', 'teamwork'], uses: ['iv'],
      birds: ['peacock'], positions: ['resident'], rowVersion: 3, captureType: 'text',
      createdAt: days(15), updatedAt: days(4), submittedAt: days(5), openedAt: days(4), statusChangedAt: days(4),
      audio: null, audioAssetId: '', audioDurationMs: 0,
      visibility: 'mentor_visible', visibilityChangedAt: days(15), origin: { type: 'capture' },
      versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
      history: [hist(days(15), 'Dr Brian', 'story.captured', ''), hist(days(5), 'Dr Brian', 'story.submitted', ''), hist(days(4), 'Dr Brian', 'story.opened', '')],
    },
    {
      id: 's-104', studentId: 'u-founder', studentName: 'Dr Brian',
      title: 'I Missed the Bus in Managua', prefixEnabled: true,
      originalTitle: 'I Missed the Bus in Managua',
      originalText: 'I missed the last bus after a volunteer clinic day in Managua and a family I had met that morning walked me forty minutes home, teaching me Nicaraguan slang the whole way.',
      text: 'I missed the last bus after a volunteer clinic day in Managua. A family I had met that morning — the mother had brought in three kids for vaccines — saw me standing at the empty stop and simply refused to leave me there. They walked me forty minutes home, teaching me Nicaraguan slang the whole way, and the youngest quizzed me at every corner. I arrived embarrassed and adopted. Kindness has a direction of travel: it flows back to the people who think they are there to give it.',
      lesson: '',
      status: 'private', revised: false, studentScore: 2, mentorScore: 0, reviewSuitability: '',
      studentStar: false, mentorStar: false, themes: ['identity'], categories: ['personal', 'volunteer_service'], uses: [],
      birds: [], positions: [], rowVersion: 2, captureType: 'text',
      createdAt: days(6), updatedAt: days(6),
      audio: null, audioAssetId: '', audioDurationMs: 0,
      visibility: 'private', visibilityChangedAt: days(6), origin: { type: 'capture' },
      versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
      history: [hist(days(6), 'Dr Brian', 'story.captured', ''), hist(days(6), 'Dr Brian', 'story.visibility_changed', 'to Private — visible only to me')],
    },
    {
      id: 's-105', studentId: 'u-founder', studentName: 'Dr Brian',
      title: 'the Printer Saved a Life', prefixEnabled: true,
      originalTitle: 'the Printer Saved a Life',
      originalText: 'A discharge printer jammed, which annoyed everyone — until the delay meant a nurse caught a medication interaction nobody had noticed. The patient stayed one more night.',
      text: 'A discharge printer jammed on a Friday afternoon, which annoyed everyone — until the twenty-minute delay meant the discharging nurse re-read the medication list and caught an interaction three of us had missed. The patient stayed one more night and went home safe. I keep this story to stay humble about checklists: sometimes the system’s redundancy is a jammed printer and a nurse who reads carefully when she is forced to slow down.',
      lesson: 'Slowing down is a safety mechanism — build it in on purpose.',
      status: 'changes', revised: true, studentScore: 3, mentorScore: 3, reviewSuitability: 'interview_only',
      studentStar: false, mentorStar: false, themes: ['mistake'], categories: ['clinical', 'ethics_professionalism'], uses: ['iv'],
      birds: ['owl'], positions: ['apd'], rowVersion: 6, captureType: 'text',
      createdAt: days(19), updatedAt: days(2), submittedAt: days(12), openedAt: days(11), reviewedAt: days(10),
      statusChangedAt: days(10), feedbackSentAt: days(10), studentRespondedAt: days(2), reviewedByName: 'Dr Brian', reviewedByRole: 'admin',
      audio: null, audioAssetId: '', audioDurationMs: 0,
      visibility: 'mentor_visible', visibilityChangedAt: days(12), origin: { type: 'capture' },
      versions: {}, feedback: [{ body: 'Good bones. Rework the ending so it is about your behavior change, not the printer’s.', author_name: 'Dr Brian', created_at: days(10) }],
      mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
      history: [hist(days(19), 'Dr Brian', 'story.captured', ''), hist(days(12), 'Dr Brian', 'story.submitted', ''), hist(days(10), 'Dr Brian', 'story.status_changed', 'to Changes requested'), hist(days(2), 'Dr Brian', 'story.working_version_edited', '')],
    },
    {
      id: 's-106', studentId: 'u-founder', studentName: 'Dr Brian',
      title: 'My Father’s Store Flooded', prefixEnabled: true,
      originalTitle: 'My Father’s Store Flooded',
      originalText: 'The year the river rose, my father’s store flooded twice. The second time, the neighbors arrived before the water did. I was twelve and I carried ledgers to the roof.',
      text: 'The year the river rose, my father’s store flooded twice. The first time we lost half the inventory and my father didn’t speak at dinner for a week. The second time, the neighbors arrived before the water did — a whole street of people who had heard the forecast and shown up with sandbags and crates. I was twelve and my job was carrying the handwritten ledgers to the roof. Watching my father accept help taught me more about strength than watching him refuse it ever had. I decided that whatever I became, I wanted to be the kind of person the street shows up for — and the kind who shows up.',
      lesson: 'Accepting help is a strength — communities are built by people who show up.',
      status: 'reviewed', revised: false, studentScore: 5, mentorScore: 4, reviewSuitability: 'ps_only',
      studentStar: true, mentorStar: false, themes: ['resil'], categories: ['personal', 'adversity_challenge'], uses: ['ps', 'myeras_experiences'],
      birds: ['eagle', 'dove'], positions: ['pd', 'faculty'], rowVersion: 11, captureType: 'audio',
      createdAt: days(30), updatedAt: hours(26), submittedAt: days(25), openedAt: days(24), reviewedAt: days(22),
      statusChangedAt: days(22), feedbackSentAt: days(22), reviewedByName: 'Dr Brian', reviewedByRole: 'admin',
      audio: { id: 'aud-106', durationMs: AUDIO_MS }, audioAssetId: 'aud-106', audioDurationMs: AUDIO_MS,
      visibility: 'mentor_visible', visibilityChangedAt: days(25), origin: { type: 'capture' },
      versions: {
        thirty_second: ver('The year the river rose, my father’s store flooded twice. The second time, the neighbors arrived before the water did, and my job at twelve was carrying the ledgers to the roof. Watching my father accept help taught me what strength looks like — and made me want to be someone the street shows up for.', days(8), 'typed', [
          { id: 'rev-106-30-1', body: 'My father’s store flooded twice the year the river rose. The second time the neighbors came before the water. I carried ledgers to the roof, age twelve.', savedAt: days(14), source: 'voice' },
        ]),
        nnq_setup: ver('When I was twelve my father’s store flooded twice in one year. The second flood, our neighbors arrived before the water did, and I carried the handwritten ledgers to the roof while my father learned to accept help. That flood is where my definition of teamwork comes from — which is probably why the moments I’m proudest of in medicine are the ones where I asked for help early.', days(8), 'typed'),
      },
      feedback: [{ body: 'This is a personal-statement anchor. The ledgers detail is unforgettable.', author_name: 'Dr Brian', created_at: days(22) }],
      mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 1, useSuggestions: [],
      history: [
        hist(days(30), 'Dr Brian', 'story.captured', 'from a voice note'),
        hist(days(25), 'Dr Brian', 'story.submitted', ''),
        hist(days(22), 'Dr Brian', 'story.status_changed', 'to Reviewed'),
        hist(days(14), 'Dr Brian', 'story.version_edited', '30-Second Version (voice — Retell)'),
        hist(days(8), 'Dr Brian', 'story.version_edited', 'NNQ Setup Version'),
        hist(hours(26), 'Dr Brian', 'story.version_edited', '30-Second Version'),
      ],
    },
    {
      id: 's-107', studentId: 'u-founder', studentName: 'Dr Brian',
      title: 'I Learned to Say I Don’t Know', prefixEnabled: true,
      originalTitle: 'I Learned to Say I Don’t Know',
      originalText: 'An attending asked me a question on rounds and I guessed. He knew. Everyone knew.',
      text: 'An attending asked me a question on rounds and I guessed instead of saying I don’t know. He knew. Everyone knew.',
      lesson: '',
      status: 'private', revised: false, studentScore: 4, mentorScore: 0, reviewSuitability: '',
      studentStar: false, mentorStar: false, themes: ['mistake'], categories: ['clinical'], uses: [],
      birds: [], positions: [], rowVersion: 1, captureType: 'text',
      createdAt: days(3), updatedAt: days(3),
      audio: null, audioAssetId: '', audioDurationMs: 0,
      visibility: 'mentor_visible', visibilityChangedAt: days(3), origin: { type: 'capture' },
      versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
      history: [hist(days(3), 'Dr Brian', 'story.captured', '')],
    },
    /* Maya's stories (persona: student) */
    {
      id: 's-201', studentId: 'u-maya', studentName: 'Maya Osei',
      title: 'the Anatomy Lab Playlist', prefixEnabled: true,
      originalTitle: 'the Anatomy Lab Playlist',
      originalText: 'Our anatomy table argued for a week about the lab playlist until we invented a rotation. It became the way we made every group decision that year.',
      text: 'Our anatomy table argued for a week about the lab playlist until we invented a strict rotation — one person’s music per session, no vetoes. It became the template for every group decision we made that year, from dissection roles to exam review schedules. Small fair systems beat big arguments.',
      lesson: 'Small fair systems beat big arguments.',
      status: 'private', revised: false, studentScore: 3, mentorScore: 0, reviewSuitability: '',
      studentStar: false, mentorStar: false, themes: ['team'], categories: ['personal', 'teamwork'], uses: [],
      birds: [], positions: [], rowVersion: 2, captureType: 'text',
      createdAt: days(11), updatedAt: days(7),
      audio: null, audioAssetId: '', audioDurationMs: 0,
      visibility: 'private', visibilityChangedAt: days(11), origin: { type: 'capture' }, legacyPrivate: true,
      versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
      history: [hist(days(11), 'Maya Osei', 'story.captured', '')],
    },
    {
      id: 's-202', studentId: 'u-maya', studentName: 'Maya Osei',
      title: 'the Interpreter Was My Mother', prefixEnabled: true,
      originalTitle: 'the Interpreter Was My Mother',
      originalText: 'Growing up I translated school letters for my mother. In my first clinic, watching a child translate a diagnosis for her father, I recognized the weight on her shoulders instantly.',
      text: 'Growing up I translated school letters for my mother. In my first clinic, watching a child translate a diagnosis for her father, I recognized the weight on her shoulders instantly — and I asked for a professional interpreter, for the father and for the child. Some advocacy comes from textbooks. Mine came from kitchen-table translation.',
      lesson: 'Lived experience is clinical skill when you let it be.',
      status: 'awaiting', revised: false, studentScore: 5, mentorScore: 0, reviewSuitability: '',
      studentStar: true, mentorStar: false, themes: ['advoc'], categories: ['clinical', 'communication'], uses: ['ps', 'iv'],
      birds: ['dove'], positions: ['pd'], rowVersion: 3, captureType: 'text',
      createdAt: days(8), updatedAt: days(2), submittedAt: days(2), statusChangedAt: days(2),
      audio: null, audioAssetId: '', audioDurationMs: 0,
      visibility: 'mentor_visible', visibilityChangedAt: days(2), origin: { type: 'capture' },
      versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
      history: [hist(days(8), 'Maya Osei', 'story.captured', ''), hist(days(2), 'Maya Osei', 'story.submitted', '')],
    },
    /* Jonas (studentOther) — proves cross-student boundary */
    {
      id: 's-301', studentId: 'u-second', studentName: 'Jonas Wirth',
      title: 'the Bakery Shift Before the Exam', prefixEnabled: true,
      originalTitle: 'the Bakery Shift Before the Exam',
      originalText: 'I worked the 4 a.m. bakery shift the morning of my physiology final.',
      text: 'I worked the 4 a.m. bakery shift the morning of my physiology final, because my family needed the shift covered and the exam didn’t care. I passed both.',
      lesson: 'Responsibilities don’t take turns — you learn to carry two things.',
      status: 'awaiting', revised: false, studentScore: 4, mentorScore: 0, reviewSuitability: '',
      studentStar: false, mentorStar: false, themes: ['resil'], categories: ['personal', 'adversity_challenge'], uses: ['iv'],
      birds: [], positions: [], rowVersion: 2, captureType: 'text',
      createdAt: days(5), updatedAt: days(3), submittedAt: days(3), statusChangedAt: days(3),
      audio: null, audioAssetId: '', audioDurationMs: 0,
      visibility: 'mentor_visible', visibilityChangedAt: days(3), origin: { type: 'capture' },
      versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
      history: [hist(days(5), 'Jonas Wirth', 'story.captured', ''), hist(days(3), 'Jonas Wirth', 'story.submitted', '')],
    },
  ];

  /* ---------- admin directory (all trusted, verified, active eligible 360 students) ---------- */
  const DIRECTORY = [
    { id: 'u-founder', name: 'Dr Brian', username: 'brinyu', entitlement: 'active', provisioned: days(120), lastActivity: hours(2), storyCounts: { total: 7, complete: 4, unfinished: 3, private: 2, mentorVisible: 5, submitted: 4, awaiting: 1, inReview: 1, changes: 1, reviewed: 1, approved: 1, archived: 0 }, lastReview: days(18), reviewCheck: null, warnings: [] },
    { id: 'u-maya', name: 'Maya Osei', username: 'maya.osei', entitlement: 'active', provisioned: days(60), lastActivity: days(2), storyCounts: { total: 2, complete: 2, unfinished: 0, private: 1, mentorVisible: 1, submitted: 1, awaiting: 1, inReview: 0, changes: 0, reviewed: 0, approved: 0, archived: 0 }, lastReview: null, reviewCheck: null, warnings: [] },
    { id: 'u-second', name: 'Jonas Wirth', username: 'jonas.wirth', entitlement: 'active', provisioned: days(58), lastActivity: days(3), storyCounts: { total: 1, complete: 1, unfinished: 0, private: 0, mentorVisible: 1, submitted: 1, awaiting: 1, inReview: 0, changes: 0, reviewed: 0, approved: 0, archived: 0 }, lastReview: null, reviewCheck: days(1), warnings: [] },
    { id: 'u-st4', name: 'Amara Nwosu', username: 'amara.n', entitlement: 'active', provisioned: days(45), lastActivity: days(1), storyCounts: { total: 5, complete: 3, unfinished: 2, private: 3, mentorVisible: 2, submitted: 2, awaiting: 0, inReview: 1, changes: 0, reviewed: 1, approved: 0, archived: 0 }, lastReview: days(6), reviewCheck: null, warnings: [] },
    { id: 'u-st5', name: 'Diego Fuentes', username: 'diego.f', entitlement: 'active', provisioned: days(90), lastActivity: days(14), storyCounts: { total: 3, complete: 1, unfinished: 2, private: 2, mentorVisible: 1, submitted: 0, awaiting: 0, inReview: 0, changes: 0, reviewed: 0, approved: 0, archived: 0 }, lastReview: null, reviewCheck: days(4), warnings: ['No submission in 90 days'] },
    { id: 'u-st6', name: 'Priya Raman', username: 'priya.r', entitlement: 'active', provisioned: days(30), lastActivity: days(29), storyCounts: { total: 0, complete: 0, unfinished: 0, private: 0, mentorVisible: 0, submitted: 0, awaiting: 0, inReview: 0, changes: 0, reviewed: 0, approved: 0, archived: 0 }, lastReview: null, reviewCheck: null, warnings: ['Provisioned 30 days ago · no StoryForge activity yet'] },
    { id: 'u-st7', name: 'Tomasz Kowal', username: 'tomasz.k', entitlement: 'active', provisioned: days(21), lastActivity: days(5), storyCounts: { total: 1, complete: 0, unfinished: 1, private: 1, mentorVisible: 0, submitted: 0, awaiting: 0, inReview: 0, changes: 0, reviewed: 0, approved: 0, archived: 0 }, lastReview: null, reviewCheck: null, warnings: [] },
    { id: 'u-st8', name: 'Leila Haddad', username: 'leila.h', entitlement: 'active', provisioned: days(75), lastActivity: hours(8), storyCounts: { total: 6, complete: 5, unfinished: 1, private: 1, mentorVisible: 5, submitted: 4, awaiting: 2, inReview: 0, changes: 1, reviewed: 1, approved: 0, archived: 1 }, lastReview: days(9), reviewCheck: null, warnings: [] },
    { id: 'u-st9', name: 'Kenji Sato', username: 'kenji.s', entitlement: 'renewal_due', provisioned: days(200), lastActivity: days(40), storyCounts: { total: 2, complete: 2, unfinished: 0, private: 0, mentorVisible: 2, submitted: 2, awaiting: 0, inReview: 0, changes: 0, reviewed: 2, approved: 0, archived: 0 }, lastReview: days(45), reviewCheck: null, warnings: ['LearnDash entitlement renewal due in 14 days'] },
    { id: 'u-st10', name: 'Fatima Al-Rashid', username: 'fatima.a', entitlement: 'active', provisioned: days(12), lastActivity: days(12), storyCounts: { total: 0, complete: 0, unfinished: 0, private: 0, mentorVisible: 0, submitted: 0, awaiting: 0, inReview: 0, changes: 0, reviewed: 0, approved: 0, archived: 0 }, lastReview: null, reviewCheck: days(2), warnings: ['Provisioned · no StoryForge activity yet'] },
    { id: 'u-st11', name: 'Grace Adeyemi', username: 'grace.a', entitlement: 'active', provisioned: days(50), lastActivity: days(6), storyCounts: { total: 4, complete: 2, unfinished: 2, private: 2, mentorVisible: 2, submitted: 1, awaiting: 1, inReview: 0, changes: 0, reviewed: 0, approved: 0, archived: 0 }, lastReview: null, reviewCheck: null, warnings: [] },
    { id: 'u-st12', name: 'Marco Bellini', username: 'marco.b', entitlement: 'active', provisioned: days(33), lastActivity: days(33), storyCounts: { total: 0, complete: 0, unfinished: 0, private: 0, mentorVisible: 0, submitted: 0, awaiting: 0, inReview: 0, changes: 0, reviewed: 0, approved: 0, archived: 0 }, lastReview: null, reviewCheck: null, warnings: ['Provisioned 33 days ago · no StoryForge activity yet', 'Welcome email bounced — address may be stale'] },
  ];

  /* R2: sessions (canonical MissionMed 360 cohort concept — consumed, not duplicated) */
  const SESSIONS = ['360 Spring 2026', '360 Summer 2026', '360 Fall 2025', '360 Winter 2025'];
  DIRECTORY.forEach((d, i) => { d.session = SESSIONS[i % 2]; });
  const R2_QUEUE_SEED = []; /* db doesn't exist yet — seeded stories join db.stories right after it does */
  (function b1513r2Scale() {
    const first = ['Aisha','Omar','Elena','Raj','Sofia','Chen','Fatou','Luis','Hana','Piotr','Nia','Tarek','Ines','Yuki','Kwame','Lara','Mateo','Zara','Ivan','Amina','Noor','Diego','Mei','Ade','Rosa','Karim','Eva','Jan','Lily','Sam','Tomas','Ana','Ravi','Maja','Femi','Duc','Sara','Alex','Nina','Emre','Lucia','Owen','Priyanka','Bilal','Greta','Hugo','Iris','Jonel','Kofi','Lena','Milan','Nadia','Omar','Paula','Quinn'];
    const last = ['Okafor','Haddad','Petrov','Sharma','Rossi','Wang','Diallo','Garcia','Kimura','Nowak','Mensah','Aziz','Costa','Tanaka','Boateng','Silva','Reyes','Khan','Dimitrov','Sy','Rahman','Molina','Lin','Adeyemi','Marquez','Nasser','Horvat','Dvorak','Chen','Osei'];
    let seed = 0x9e3779b9;
    const rnd = () => { seed ^= seed << 13; seed ^= seed >>> 17; seed ^= seed << 5; return (seed >>> 0) / 4294967296; };
    for (let i = 0; i < 110; i += 1) {
      const name = `${first[Math.floor(rnd() * first.length)]} ${last[Math.floor(rnd() * last.length)]}`;
      const total = Math.floor(rnd() * 7);
      const submitted = total ? Math.floor(rnd() * (total + 1)) : 0;
      const awaiting = submitted ? Math.floor(rnd() * Math.min(3, submitted + 1)) : 0;
      const changes = submitted && rnd() < 0.18 ? 1 : 0;
      const lastAct = total === 0 ? (rnd() < 0.5 ? null : days(20 + rnd() * 60)) : days(rnd() * 30);
      const id = `u-syn-${i}`;
      DIRECTORY.push({
        id, name, username: name.toLowerCase().replace(/\s+/g, '.'),
        entitlement: rnd() < 0.06 ? 'renewal_due' : 'active',
        provisioned: days(30 + rnd() * 180), lastActivity: lastAct,
        session: SESSIONS[Math.floor(rnd() * SESSIONS.length)],
        storyCounts: { total, complete: Math.floor(total * 0.6), unfinished: total - Math.floor(total * 0.6), private: Math.floor(rnd() * (total + 1) * 0.4), mentorVisible: total, submitted, awaiting, inReview: submitted - awaiting > 0 && rnd() < 0.3 ? 1 : 0, changes, reviewed: Math.max(0, submitted - awaiting - changes), approved: rnd() < 0.2 && submitted ? 1 : 0, archived: 0 },
        lastReview: submitted && rnd() < 0.5 ? days(rnd() * 40) : null,
        reviewCheck: null, warnings: total === 0 && rnd() < 0.3 ? ['No StoryForge activity yet'] : [],
      });
      if (awaiting && i % 3 === 0) {
        const t = ['the Night Bus Diagnosis','My First Code Blue','the Translator at Bed 4','the Exam I Almost Missed','the Patient Who Taught Me','the Long Walk to Clinic'][Math.floor(rnd() * 6)];
        R2_QUEUE_SEED.push({
          id: `s-syn-${i}`, studentId: id, studentName: name, title: t, prefixEnabled: true,
          originalTitle: t, originalText: 'Synthetic queue story for scale demonstration.', text: 'Synthetic queue story for scale demonstration — full text lives with the student.',
          lesson: '', status: rnd() < 0.7 ? 'awaiting' : 'in_review', revised: false, studentScore: Math.ceil(rnd() * 5), mentorScore: 0,
          reviewSuitability: '', studentStar: false, mentorStar: false, themes: [], categories: [], uses: [], birds: [], positions: [],
          rowVersion: 1, captureType: 'text', createdAt: days(5 + rnd() * 25), updatedAt: days(rnd() * 20),
          submittedAt: days(rnd() * 21), statusChangedAt: days(rnd() * 15),
          audio: null, audioAssetId: '', audioDurationMs: 0,
          visibility: 'mentor_visible', visibilityChangedAt: days(10), origin: { type: 'capture' },
          versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
          history: [],
        });
      }
    }
  }());

  const ACTIVITY = {
    'u-founder': { availableFrom: ACTIVITY_FROM, sessions: [{ startedAt: hours(2), activeMinutes: 24, surface: 'Story Detail · Inspiration' }, { startedAt: hours(20), activeMinutes: 11, surface: 'Library' }], totals: { sessionCount: 2, activeMinutes: 35, averageMinutes: 18 }, counters: { storiesOpened: 6, storiesCreated: 1, storiesAdvanced: 2, submissions: 1, reviewsOpened: 3, versionEdits: 3, inspirationAnswers: 2 } },
    'u-maya': { availableFrom: ACTIVITY_FROM, sessions: [], totals: null, counters: null },
  };

  /* ---------- inspiration ---------- */
  const INSPIRATION_SAVED = {
    'u-founder': [
      { id: 'insp-save-1', promptId: 'q-012', promptText: PROMPT_LIBRARY?.prompts?.find((p) => p.id === 'q-012')?.text || 'Tell me about a small act of kindness from a stranger that you still remember.', savedAt: days(1), draft: '' },
    ],
  };
  const INSPIRATION_SESSIONS = {};

  /* ---------- notifications ---------- */
  const NOTIFICATIONS = {
    'u-founder': [
      { id: 'n-1', text: 'Dr Brian reviewed “The One Where the Code Cart Wouldn’t Open” — Approved, with feedback.', story_id: 's-101', created_at: days(18), read_at: days(17) },
      { id: 'n-2', text: 'Dr Brian requested changes on “The One Where the Printer Saved a Life.”', story_id: 's-105', created_at: days(10), read_at: null },
    ],
    'u-maya': [
      { id: 'n-3', text: 'Dr Brian checked StoryForge for work to review on Aug 5, 2026 at 4:10 PM, but no stories had been submitted. When you’re ready, submit a story so your mentor can review it.', story_id: '', created_at: days(2), read_at: null, kind: 'review_check' },
    ],
    'u-second': [],
  };

  /* ---------- admin config: content & display + versions + inspiration ---------- */
  R2_QUEUE_SEED.forEach((seeded) => STORIES.push(seeded));
  const db = {
    stories: STORIES,
    contentDisplay: {
      taxonomy: DEFAULT_TAXONOMY,
      sections: DEFAULT_SECTIONS,
      navigation: { interviewPrepVisible: false },
      b1513: b1513Presentation(),
      rowVersion: 4,
      updatedAt: days(1),
    },
    inspirationAdmin: {
      rowVersion: 2,
      updatedAt: days(1),
      dimensions: PROMPT_LIBRARY?.dimensions || null,
      prompts: (PROMPT_LIBRARY?.prompts || []).map((p, i) => ({ ...p, state: 'active', sortOrder: (i + 1) * 10 })),
    },
    recordings: {},
    reviewChecks: [{ id: 'rc-1', studentId: 'u-second', sentAt: days(1), sentBy: 'Dr Brian', body: 'Dr Brian checked StoryForge for work to review on Aug 6, 2026, but no stories had been submitted…', status: 'delivered' },
      { id: 'rc-0', studentId: 'u-st10', sentAt: days(2), sentBy: 'Dr Brian', body: 'Dr Brian checked StoryForge for work to review on Aug 5, 2026, but no stories had been submitted…', status: 'delivered' }],
    auditSeq: 1000,
  };

  /* ================================================================
   * ROUTER
   * ================================================================ */
  let currentPersona = null;
  const personaFromToken = (token) => String(token || '').replace(/^proto-token\./, '') || null;

  function ownerStories(userId) {
    return db.stories.filter((s) => s.studentId === userId);
  }
  function findStory(id) {
    return db.stories.find((s) => s.id === id) || null;
  }
  function cloneStory(story) {
    return JSON.parse(JSON.stringify(story));
  }
  function actorDisplay() {
    return USERS[currentPersona]?.user?.display_name || 'StoryForge';
  }
  function pushHistory(story, action, detail) {
    story.history = story.history || [];
    story.history.unshift({ created_at: new Date().toISOString(), actor_display: actorDisplay(), action, detail });
  }
  function json(payload, status = 200) {
    return new Response(JSON.stringify(payload ?? {}), { status, headers: { 'Content-Type': 'application/json' } });
  }
  function errorJson(code, message, status = 400) {
    return json({ code, message }, status);
  }

  function directoryEntry(id) {
    return DIRECTORY.find((d) => d.id === id) || null;
  }

  function reviewCheckBody(entry) {
    const when = new Date().toLocaleString(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
    const submitted = entry.storyCounts.submitted > 0;
    const reviewed = entry.lastReview !== null;
    if (submitted && reviewed) {
      return `Dr Brian checked StoryForge on ${when} and reviewed your submitted work. Open your stories to see the latest feedback.`;
    }
    if (submitted) {
      return `Dr Brian checked StoryForge on ${when}. Your submitted work is in the review queue — feedback will land in your notifications.`;
    }
    return `Dr Brian checked StoryForge for work to review on ${when}, but no stories had been submitted. When you're ready, submit a story so your mentor can review it.`;
  }

  const SUBMITTED_STATES = ['awaiting', 'in_review', 'changes', 'reviewed', 'approved'];

  async function route(method, path, body, init) {
    /* -------- public -------- */
    if (path.endsWith('/api/config') || path.endsWith('api/config')) {
      return json({
        devAuth: true,
        premiumMotion: true,
        basePath: '/',
        matrixBaseUrl: '#matrix-prototype',
        prototype: 'B1-513',
      });
    }
    const devMatch = path.match(/\/api\/dev\/session\/([a-zA-Z]+)$/);
    if (devMatch) {
      const persona = devMatch[1];
      if (!USERS[persona]) return errorJson('unknown_persona', 'Unknown fixture persona.', 404);
      currentPersona = persona;
      return json({ token: `proto-token.${persona}` });
    }

    /* -------- identify actor -------- */
    const authHeader = init?.headers?.Authorization || init?.headers?.authorization || '';
    const persona = personaFromToken(authHeader.replace(/^Bearer\s+/i, '')) || currentPersona;
    if (!persona || !USERS[persona]) return errorJson('unauthenticated', 'No signed StoryForge identity.', 401);
    currentPersona = persona;
    const account = USERS[persona];
    const me = account.user;

    if (path.endsWith('/api/session')) {
      return json({ user: me, capabilities: account.capabilities, b1513: { consent: account.consent, features: { versions: true, inspiration: true, visibility: true, directory: true, activity: true, reviewCheck: true } } });
    }
    if (path.endsWith('/api/presentation')) {
      return json({ configuration: { payload: presentationPayload(), rowVersion: db.contentDisplay.rowVersion, updatedAt: db.contentDisplay.updatedAt } });
    }

    /* -------- consent -------- */
    if (path.endsWith('/api/consent') && method === 'GET') {
      return json({ consent: account.consent, policy: CONSENT_POLICY });
    }
    if (path.endsWith('/api/consent') && method === 'POST') {
      const decision = body?.decision === 'accept' ? 'accept' : 'defer';
      if (decision === 'accept') {
        account.consent = { accepted: true, policyVersion: CONSENT_POLICY.version, acceptedAt: new Date().toISOString(), auditId: `consent-a-${db.auditSeq += 1}` };
      } else {
        account.consent = { accepted: false, deferredAt: new Date().toISOString(), policyVersion: CONSENT_POLICY.version };
      }
      return json({ consent: account.consent, receipt: { auditId: account.consent.auditId || `consent-defer-${db.auditSeq += 1}`, at: new Date().toISOString(), policyVersion: CONSENT_POLICY.version } });
    }

    /* -------- stories (student-owned) -------- */
    if (path.endsWith('/api/stories') && method === 'GET') {
      return json({ stories: ownerStories(me.id).map(cloneStory) });
    }
    if (path.endsWith('/api/stories') && method === 'POST') {
      const consented = account.consent?.accepted === true;
      const story = {
        id: `s-new-${db.auditSeq += 1}`,
        studentId: me.id, studentName: me.display_name,
        title: String(body?.title || 'Untitled story').replace(/^The One Where\s*/i, ''),
        prefixEnabled: body?.prefixEnabled !== false,
        originalTitle: String(body?.title || 'Untitled story'),
        originalText: String(body?.text || ''),
        text: String(body?.text || ''),
        lesson: String(body?.lesson || ''),
        status: 'private', revised: false, studentScore: Number(body?.studentScore || 0), mentorScore: 0,
        reviewSuitability: '', studentStar: false, mentorStar: false,
        themes: body?.themes || [], categories: body?.categories || [], uses: body?.uses || [],
        birds: [], positions: [], rowVersion: 1,
        captureType: body?.recordingId ? 'audio' : 'text',
        createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
        audio: body?.recordingId ? { id: `aud-${db.auditSeq}`, durationMs: AUDIO_MS } : null,
        audioAssetId: body?.recordingId ? `aud-${db.auditSeq}` : '', audioDurationMs: body?.recordingId ? AUDIO_MS : 0,
        visibility: consented ? 'mentor_visible' : 'private',
        visibilityChangedAt: new Date().toISOString(),
        origin: body?.origin || { type: 'capture' },
        versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
        history: [],
      };
      pushHistory(story, 'story.captured', story.origin?.type === 'inspiration' ? `from Inspiration — “${(story.origin.promptText || '').slice(0, 90)}”` : (story.captureType === 'audio' ? 'from a voice note' : ''));
      db.stories.unshift(story);
      return json({ story: cloneStory(story) });
    }

    const storyMatch = path.match(/\/api\/stories\/([^/]+)(?:\/([^/]+))?(?:\/([^/]+))?$/);
    if (storyMatch) {
      const story = findStory(decodeURIComponent(storyMatch[1]));
      const sub = storyMatch[2];
      const subId = storyMatch[3];
      if (!story) return errorJson('P0002', 'Story not found.', 404);
      const isOwner = story.studentId === me.id;
      const reviewer = (me.role === 'admin' || (me.role === 'student' && account.capabilities.adminConsole));
      const mentorRole = me.role === 'mentor';
      const observable = story.visibility === 'mentor_visible' || SUBMITTED_STATES.includes(story.status);
      if (!isOwner && !((reviewer || mentorRole) && observable)) {
        return errorJson('P0002', 'Story not found.', 404); // private = absent by direct ID as well as lists
      }
      if (!sub && method === 'GET') return json({ story: cloneStory(story) });
      if (!sub && method === 'PATCH') {
        if (!isOwner) return errorJson('forbidden', 'Only the owning student can edit.', 403);
        if (body?.title !== undefined) story.title = String(body.title).replace(/^The One Where\s*/i, '');
        if (body?.text !== undefined && body.text !== story.text) { story.text = String(body.text); pushHistory(story, 'story.working_version_edited', ''); }
        if (body?.lesson !== undefined && body.lesson !== story.lesson) { story.lesson = String(body.lesson); pushHistory(story, 'story.lesson_edited', ''); }
        story.updatedAt = new Date().toISOString();
        story.rowVersion += 1;
        return json({ story: cloneStory(story) });
      }
      if (sub === 'submit') {
        story.status = story.status === 'changes' ? 'awaiting' : 'awaiting';
        story.revised = story.revised || storyMatch && story.submittedAt ? story.revised : false;
        story.submittedAt = new Date().toISOString();
        story.statusChangedAt = story.submittedAt;
        if (story.visibility !== 'mentor_visible') { story.visibility = 'mentor_visible'; story.visibilityChangedAt = story.submittedAt; pushHistory(story, 'story.visibility_changed', 'to Mentor Visible (submitted for review)'); }
        story.rowVersion += 1;
        pushHistory(story, 'story.submitted', '');
        return json({ story: cloneStory(story) });
      }
      if (sub === 'withdraw') {
        story.status = 'private';
        story.statusChangedAt = new Date().toISOString();
        story.rowVersion += 1;
        pushHistory(story, 'story.status_changed', 'withdrawn — review access removed');
        return json({ story: cloneStory(story) });
      }
      if (sub === 'visibility' && method === 'POST') {
        if (!isOwner) return errorJson('forbidden', 'Only the owning student controls visibility.', 403);
        const next = body?.visibility === 'private' ? 'private' : 'mentor_visible';
        if (SUBMITTED_STATES.includes(story.status) && next === 'private') {
          return errorJson('visibility_submitted', 'This story is submitted for review. Use “Return to Private” to withdraw it first.', 409);
        }
        story.visibility = next;
        story.visibilityChangedAt = new Date().toISOString();
        story.rowVersion += 1;
        pushHistory(story, 'story.visibility_changed', next === 'private' ? 'to Private — visible only to me' : 'to Mentor Visible');
        return json({ story: cloneStory(story) });
      }
      if (sub === 'versions' && method === 'PATCH' && subId) {
        if (!isOwner) return errorJson('forbidden', 'Only the owning student can edit versions.', 403);
        const key = decodeURIComponent(subId);
        if (key === 'original') return errorJson('version_protected', 'The Original telling is provenance-protected and cannot be edited.', 403);
        if (key === 'full_story') return errorJson('use_story_patch', 'Full Story is the canonical working text — use the story PATCH.', 400);
        const labels = { thirty_second: '30-Second Version', nnq_setup: 'NNQ Setup Version' };
        if (!labels[key]) return errorJson('unknown_version', 'Unknown version key.', 404);
        const existing = story.versions[key];
        const mode = body?.mode === 'retell' ? 'retell' : body?.mode === 'append' ? 'append' : 'save';
        const nextBody = String(body?.body ?? '');
        if (existing && (mode === 'retell' || (mode === 'save' && existing.body !== nextBody))) {
          existing.revisions = existing.revisions || [];
          existing.revisions.unshift({ id: `rev-${db.auditSeq += 1}`, body: existing.body, savedAt: existing.updatedAt, source: existing.source });
        }
        const source = body?.source === 'voice' ? 'voice' : 'typed';
        story.versions[key] = {
          body: mode === 'append' && existing ? `${existing.body}${existing.body ? '\n\n' : ''}${nextBody}` : nextBody,
          updatedAt: new Date().toISOString(),
          createdAt: existing?.createdAt || new Date().toISOString(),
          source,
          rowVersion: (existing?.rowVersion || 0) + 1,
          revisions: existing?.revisions || [],
        };
        story.updatedAt = new Date().toISOString();
        pushHistory(story, 'story.version_edited', `${labels[key]}${source === 'voice' ? (mode === 'append' ? ' (voice — Append)' : ' (voice — Retell)') : mode === 'retell' ? ' (Retell)' : ''}`);
        return json({ story: cloneStory(story) });
      }
      if (sub === 'versions' && method === 'POST' && subId && path.includes('/restore')) {
        return errorJson('not_implemented', 'Use the restore endpoint.', 400);
      }
      if (sub === 'version-restore' && method === 'POST') {
        if (!isOwner) return errorJson('forbidden', 'Only the owning student can restore versions.', 403);
        const key = String(body?.versionKey || '');
        const revId = String(body?.revisionId || '');
        const version = story.versions[key];
        const revision = version?.revisions?.find((r) => r.id === revId);
        if (!version || !revision) return errorJson('P0002', 'Revision not found.', 404);
        version.revisions.unshift({ id: `rev-${db.auditSeq += 1}`, body: version.body, savedAt: version.updatedAt, source: version.source });
        version.body = revision.body;
        version.updatedAt = new Date().toISOString();
        version.rowVersion += 1;
        pushHistory(story, 'story.version_restored', `${key === 'thirty_second' ? '30-Second Version' : 'NNQ Setup Version'} — restored earlier telling`);
        return json({ story: cloneStory(story) });
      }
      if (sub === 'priority' && method === 'PATCH') {
        story.studentScore = Number(body?.priority ?? body?.studentScore ?? 0);
        story.rowVersion += 1;
        pushHistory(story, 'story.student_score_updated', `student score ${story.studentScore}/5`);
        return json({ story: cloneStory(story) });
      }
      if (sub === 'taxonomy' && method === 'PATCH') {
        if (Array.isArray(body?.categories)) story.categories = body.categories.map(String);
        if (Array.isArray(body?.uses)) story.uses = body.uses.map(String);
        story.rowVersion += 1;
        return json({ story: cloneStory(story) });
      }
      if (sub === 'evaluation' && method === 'PATCH') {
        if (body?.studentScore !== undefined) story.studentScore = Number(body.studentScore) || 0;
        if (body?.studentStar !== undefined) story.studentStar = Boolean(body.studentStar);
        if (body?.mentorStar !== undefined) story.mentorStar = Boolean(body.mentorStar);
        if (Array.isArray(body?.birds)) story.birds = body.birds;
        if (Array.isArray(body?.positions)) story.positions = body.positions;
        story.rowVersion += 1;
        return json({ story: cloneStory(story) });
      }
      if (sub === 'reflections' && method === 'POST') {
        story.reflections = story.reflections || [];
        story.reflections.push({ id: `refl-${db.auditSeq += 1}`, prompt: String(body?.prompt || 'What would you do differently now?'), answer: '' });
        return json({ story: cloneStory(story) });
      }
      if (sub === 'feedback' && method === 'POST') {
        story.feedback.push({ body: String(body?.body || body?.text || ''), author_name: actorDisplay(), created_at: new Date().toISOString() });
        pushHistory(story, 'story.feedback_added', '');
        return json({ story: cloneStory(story) });
      }
      if (sub === 'mentor-notes' && method === 'GET') {
        return json({ notes: story.mentorNotes });
      }
      if (sub === 'mentor-notes' && method === 'POST') {
        const note = { id: `mn-${db.auditSeq += 1}`, story_id: story.id, body: String(body?.body || ''), state: 'draft', internalOnly: Boolean(body?.internalOnly), authorName: actorDisplay(), createdAt: new Date().toISOString(), rowVersion: 1 };
        story.mentorNotes.push(note);
        return json({ note });
      }
      if (sub === 'status' && method === 'POST') {
        story.status = String(body?.status || story.status);
        story.statusChangedAt = new Date().toISOString();
        story.rowVersion += 1;
        pushHistory(story, 'story.status_changed', `to ${story.status}`);
        return json({ story: cloneStory(story) });
      }
      if (sub === 'open' && method === 'POST') return json({ ok: true });
      if (sub === 'media' && method === 'GET') return json({ media: [] });
      if (sub === 'use-suggestions') return json({ story: cloneStory(story) });
    }

    /* -------- mentor notes lifecycle -------- */
    const noteMatch = path.match(/\/api\/mentor-notes\/([^/]+)(?:\/([^/]+))?$/);
    if (noteMatch) {
      const noteId = decodeURIComponent(noteMatch[1]);
      const op = noteMatch[2];
      const story = db.stories.find((s) => s.mentorNotes.some((n) => n.id === noteId));
      const note = story?.mentorNotes.find((n) => n.id === noteId);
      if (!note) return errorJson('P0002', 'Note not found.', 404);
      if (op === 'publish') { note.state = 'published'; note.publishedAt = new Date().toISOString(); return json({ note }); }
      if (op === 'discard') { story.mentorNotes = story.mentorNotes.filter((n) => n.id !== noteId); return json({ ok: true }); }
      if (op === 'playback') return json({ url: audioUrl(), durationMs: AUDIO_MS });
      if (op === 'audio' && method === 'POST') { note.hasAudio = true; note.audioAssetId = `mn-aud-${db.auditSeq += 1}`; return json({ note }); }
      if (method === 'PATCH') { if (body?.body !== undefined) note.body = String(body.body); note.rowVersion += 1; return json({ note }); }
    }

    /* -------- notifications -------- */
    if (path.endsWith('/api/notifications') && method === 'GET') {
      return json({ notifications: NOTIFICATIONS[me.id] || [] });
    }
    const notifRead = path.match(/\/api\/notifications\/([^/]+)\/read$/);
    if (notifRead) {
      const list = NOTIFICATIONS[me.id] || [];
      const item = list.find((n) => n.id === decodeURIComponent(notifRead[1]));
      if (item) item.read_at = new Date().toISOString();
      return json({ ok: true });
    }
    if (path.endsWith('/api/notifications/read-all')) {
      (NOTIFICATIONS[me.id] || []).forEach((n) => { n.read_at = n.read_at || new Date().toISOString(); });
      return json({ ok: true });
    }

    /* -------- preferences -------- */
    if (path.endsWith('/api/preferences/background')) {
      me.background_preference = String(body?.background || 'ember');
      return json({ user: me });
    }
    if (path.endsWith('/api/preferences/theme')) {
      me.theme_preference = String(body?.theme || 'dark');
      return json({ user: me });
    }
    if (path.endsWith('/api/preferences/inspiration-layout')) {
      me.inspiration_layout = String(body?.layout || 'list');
      return json({ user: me });
    }
    if (path.endsWith('/api/preferences/text-size')) {
      me.reading_size_preference = String(body?.textSize || 'standard');
      return json({ user: me });
    }

    /* -------- recording pipeline (simulated transcription) -------- */
    if (path.endsWith('/api/recordings') && method === 'POST') {
      const id = `rec-${db.auditSeq += 1}`;
      db.recordings[id] = { id, segments: [], state: 'open', createdAt: Date.now() };
      return json({ recordingId: id, segmentPlanMs: [4000, 15000] });
    }
    const recMatch = path.match(/\/api\/recordings\/([^/]+)(?:\/([^/]+))?$/);
    if (recMatch) {
      const rec = db.recordings[decodeURIComponent(recMatch[1])];
      const op = recMatch[2];
      if (!rec) return errorJson('P0002', 'Recording not found.', 404);
      const DEMO_SENTENCES = [
        'This is the StoryForge Stage 2 prototype demonstrating live voice capture.',
        'Your words appear here as you speak, exactly like the production recorder.',
        'Pause any time — your edits to this transcript are preserved as new audio arrives.',
        'When you finish, the original audio is kept forever alongside the transcript.',
      ];
      if (op === 'segments' && method === 'POST') {
        let seq = rec.segments.length;
        if (body instanceof FormData) seq = Number(body.get('seq') ?? seq);
        rec.segments.push({ seq, transcribeState: 'transcribed', transcript: `${DEMO_SENTENCES[seq % DEMO_SENTENCES.length]} ` });
        return json({ ok: true });
      }
      if (op === 'finish') { rec.state = 'assembled'; return json({ recording: { id: rec.id, state: 'assembled', audioAssetId: `aud-${rec.id}`, durationMs: AUDIO_MS, segments: rec.segments, transcriptionAvailable: true } }); }
      if (op === 'cancel') { rec.state = 'cancelled'; return json({ ok: true }); }
      if (op === 'retry-transcription') return json({ ok: true });
      if (method === 'GET') return json({ recording: { id: rec.id, state: rec.state, segments: rec.segments, transcriptionAvailable: true, ...(rec.state === 'assembled' ? { audioAssetId: `aud-${rec.id}`, durationMs: AUDIO_MS } : {}) } });
    }
    const audioMatch = path.match(/\/api\/audio\/([^/]+)\/playback$/);
    if (audioMatch) {
      return json({ playbackUrls: [audioUrl()], durationMs: AUDIO_MS });
    }

    /* -------- drafts -------- */
    if (path.endsWith('/api/drafts/story-builder')) {
      if (method === 'GET') return json({ draft: null });
      return json({ draft: { payload: body?.payload || {}, version: (body?.expectedVersion || 0) + 1 } });
    }

    /* -------- inspiration -------- */
    if (path.endsWith('/api/inspiration') && method === 'GET') {
      const admin = db.inspirationAdmin;
      return json({
        dimensions: admin.dimensions,
        activePromptCount: admin.prompts.filter((p) => p.state === 'active').length,
        saved: INSPIRATION_SAVED[me.id] || [],
        session: INSPIRATION_SESSIONS[me.id] || null,
      });
    }
    if (path.endsWith('/api/inspiration/next') && method === 'POST') {
      const admin = db.inspirationAdmin;
      const exclude = new Set((body?.excludeIds || []).map(String));
      const sel = body || {};
      const scored = admin.prompts.filter((p) => p.state === 'active' && !exclude.has(p.id)).map((p) => {
        let score = 0;
        if (sel.who && p.who?.includes(sel.who)) score += 4;
        if (sel.whoDetail && (p.whoDetail || []).includes(sel.whoDetail)) score += 3;
        if (sel.domain && p.domain?.includes(sel.domain)) score += 2;
        if (sel.energy && p.energy?.includes(sel.energy)) score += 2;
        return { p, score };
      }).sort((a, b) => b.score - a.score || a.p.id.localeCompare(b.p.id));
      const best = scored.filter((s) => s.score >= (scored[0]?.score || 0) - 1);
      const pick = best.length ? best[Math.floor(Math.random() * Math.min(best.length, 5))].p : null;
      if (!pick) return json({ prompt: null });
      INSPIRATION_SESSIONS[me.id] = { ...sel, promptId: pick.id, at: new Date().toISOString() };
      return json({ prompt: pick });
    }
    if (path.endsWith('/api/inspiration/save-later') && method === 'POST') {
      const list = INSPIRATION_SAVED[me.id] = INSPIRATION_SAVED[me.id] || [];
      list.unshift({ id: `insp-save-${db.auditSeq += 1}`, promptId: String(body?.promptId || ''), promptText: String(body?.promptText || ''), savedAt: new Date().toISOString(), draft: String(body?.draft || '') });
      return json({ saved: list });
    }
    if (path.endsWith('/api/inspiration/save-later') && method === 'GET') {
      return json({ saved: INSPIRATION_SAVED[me.id] || [] });
    }
    const savedDel = path.match(/\/api\/inspiration\/save-later\/([^/]+)$/);
    if (savedDel && method === 'DELETE') {
      INSPIRATION_SAVED[me.id] = (INSPIRATION_SAVED[me.id] || []).filter((s) => s.id !== decodeURIComponent(savedDel[1]));
      return json({ saved: INSPIRATION_SAVED[me.id] });
    }

    /* -------- activity heartbeat (accepted, aggregated; prototype no-op) -------- */
    if (path.endsWith('/api/activity/heartbeat')) return json({ ok: true });

    /* -------- admin console -------- */
    const canConsole = account.capabilities.adminConsole === true;
    if (path.includes('/api/admin/')) {
      if (!canConsole) return errorJson('forbidden', 'Administrator workspace is not enabled for this identity.', 403);

      if (path.endsWith('/api/admin/console/home')) {
        const submitted = db.stories.filter((s) => SUBMITTED_STATES.includes(s.status));
        return json({
          metrics: {
            submittedStories: submitted.length,
            awaitingReview: submitted.filter((s) => s.status === 'awaiting').length,
            inReview: submitted.filter((s) => s.status === 'in_review').length,
            approved: submitted.filter((s) => s.status === 'approved').length,
            unscored: submitted.filter((s) => !s.mentorScore).length,
          },
          recent: submitted.slice(0, 5).map(cloneStory),
          b1513: {
            eligibleStudents: DIRECTORY.length,
            neverActive: DIRECTORY.filter((d) => d.storyCounts.total === 0).length,
            activeThisWeek: DIRECTORY.filter((d) => d.lastActivity && (NOW - new Date(d.lastActivity).getTime()) < 7 * 86400000).length,
            warnings: DIRECTORY.reduce((n, d) => n + d.warnings.length, 0),
          },
        });
      }

      if (path.includes('/api/admin/console/directory')) {
        const dirMatch = path.match(/\/api\/admin\/console\/directory\/([^/]+)$/);
        if (dirMatch) {
          const id = decodeURIComponent(dirMatch[1]);
          const entry = directoryEntry(id);
          if (!entry) return errorJson('P0002', 'Student not found.', 404);
          const visible = db.stories.filter((s) => s.studentId === id && (s.visibility === 'mentor_visible' || SUBMITTED_STATES.includes(s.status)));
          const activity = ACTIVITY[id] || { availableFrom: ACTIVITY_FROM, sessions: [], totals: null, counters: null };
          return json({
            student: entry,
            stories: visible.map(cloneStory),
            activity,
            reviews: db.stories.filter((s) => s.studentId === id && s.reviewedAt).map((s) => ({ storyId: s.id, title: s.title, reviewedAt: s.reviewedAt, status: s.status, mentorScore: s.mentorScore })),
            notifications: (NOTIFICATIONS[id] || []).map((n) => ({ id: n.id, text: n.text, created_at: n.created_at, read: Boolean(n.read_at), kind: n.kind || 'story' })),
            reviewChecks: db.reviewChecks.filter((rc) => rc.studentId === id),
            account: { entitlement: entry.entitlement, provisioned: entry.provisioned, username: entry.username, warnings: entry.warnings },
          });
        }
        const url = new URL(path, SAFE_ORIGIN);
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const filter = url.searchParams.get('filter') || '';
        const session = url.searchParams.get('session') || '';
        const sort = url.searchParams.get('sort') || 'attention';
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const pageSize = Math.min(50, Number(url.searchParams.get('pageSize') || 25));
        const daysSince = (v) => v ? (NOW - new Date(v).getTime()) / 86400000 : Infinity;
        let list = DIRECTORY.slice();
        if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.username.toLowerCase().includes(q));
        if (session) list = list.filter((d) => d.session === session);
        if (filter === 'never_active' || filter === 'never_started') list = list.filter((d) => d.storyCounts.total === 0);
        if (filter === 'awaiting' || filter === 'needs_review') list = list.filter((d) => d.storyCounts.awaiting > 0 || d.storyCounts.inReview > 0);
        if (filter === 'needs_nudge') list = list.filter((d) => d.storyCounts.total > 0 && d.storyCounts.awaiting === 0 && daysSince(d.lastActivity) > 14);
        if (filter === 'progressing') list = list.filter((d) => d.storyCounts.total > 0 && daysSince(d.lastActivity) <= 7);
        if (filter === 'changes') list = list.filter((d) => d.storyCounts.changes > 0);
        if (filter === 'warnings') list = list.filter((d) => d.warnings.length > 0);
        if (filter === 'inactive_30' || filter === 'inactive_7') list = list.filter((d) => daysSince(d.lastActivity) > (filter === 'inactive_7' ? 7 : 30));
        const sorters = {
          attention: (a, b) => (b.storyCounts.awaiting - a.storyCounts.awaiting) || (b.storyCounts.changes - a.storyCounts.changes) || a.name.localeCompare(b.name),
          name: (a, b) => a.name.localeCompare(b.name),
          recent: (a, b) => daysSince(a.lastActivity) - daysSince(b.lastActivity),
          quiet: (a, b) => daysSince(b.lastActivity) - daysSince(a.lastActivity),
          stories: (a, b) => b.storyCounts.total - a.storyCounts.total,
        };
        list.sort(sorters[sort] || sorters.attention);
        const totalFiltered = list.length;
        const pages = Math.max(1, Math.ceil(totalFiltered / pageSize));
        list = list.slice((page - 1) * pageSize, page * pageSize);
        return json({ students: list, totalFiltered, total: DIRECTORY.length, page, pages, sessions: SESSIONS, boundaries: { activityFrom: ACTIVITY_FROM } });
      }

      if (path.endsWith('/api/admin/console/review-check') && method === 'POST') {
        const entry = directoryEntry(String(body?.studentId || ''));
        if (!entry) return errorJson('P0002', 'Student not found.', 404);
        const text = reviewCheckBody(entry);
        if (body?.preview) return json({ preview: { text, studentName: entry.name, at: new Date().toISOString() } });
        const already = db.reviewChecks.find((rc) => rc.studentId === entry.id && (NOW - new Date(rc.sentAt).getTime()) < 86400000);
        if (already) return errorJson('review_check_rate_limited', `A Review Check was already sent to ${entry.name} in the last 24 hours.`, 429);
        const receipt = { id: `rc-${db.auditSeq += 1}`, studentId: entry.id, sentAt: new Date().toISOString(), sentBy: actorDisplay(), body: text, status: 'delivered' };
        db.reviewChecks.unshift(receipt);
        entry.reviewCheck = receipt.sentAt;
        (NOTIFICATIONS[entry.id] = NOTIFICATIONS[entry.id] || []).unshift({ id: `n-${db.auditSeq += 1}`, text, story_id: '', created_at: receipt.sentAt, read_at: null, kind: 'review_check' });
        return json({ receipt });
      }

      if (path.includes('/api/admin/console/students/')) {
        const m = path.match(/\/api\/admin\/console\/students\/([^/]+)$/);
        const id = decodeURIComponent(m[1]);
        const entry = directoryEntry(id);
        if (!entry) return errorJson('P0002', 'Student not found.', 404);
        return json({
          student: { id: entry.id, name: entry.name, story_count: entry.storyCounts.submitted, awaiting_review: entry.storyCounts.awaiting, unscored: 0 },
          stories: db.stories.filter((s) => s.studentId === id && SUBMITTED_STATES.includes(s.status)).map(cloneStory),
        });
      }
      if (path.includes('/api/admin/console/students')) {
        const url = new URL(path, SAFE_ORIGIN);
        const q = (url.searchParams.get('q') || '').toLowerCase();
        let list = DIRECTORY.filter((d) => d.storyCounts.submitted > 0);
        if (q) list = list.filter((d) => d.name.toLowerCase().includes(q) || d.username.toLowerCase().includes(q));
        return json({ students: list.map((d) => ({ id: d.id, name: d.name, story_count: d.storyCounts.submitted, awaiting_review: d.storyCounts.awaiting, unscored: 0 })) });
      }
      if (path.includes('/api/admin/console/queue')) {
        const url = new URL(path, SAFE_ORIGIN);
        const status = url.searchParams.get('status') || '';
        const q = (url.searchParams.get('q') || '').toLowerCase();
        const session = url.searchParams.get('session') || '';
        const sort = url.searchParams.get('sort') || 'oldest';
        const page = Math.max(1, Number(url.searchParams.get('page') || 1));
        const pageSize = Math.min(50, Number(url.searchParams.get('pageSize') || 20));
        const sessionOf = (st) => DIRECTORY.find((d) => d.id === st.studentId)?.session || '';
        let list = db.stories.filter((s) => SUBMITTED_STATES.includes(s.status));
        if (status === 'unscored') list = list.filter((s) => !s.mentorScore);
        else if (status) list = list.filter((s) => s.status === status);
        if (q) list = list.filter((s) => s.title.toLowerCase().includes(q) || s.studentName.toLowerCase().includes(q));
        if (session) list = list.filter((s) => sessionOf(s) === session);
        const sorters = {
          oldest: (a, b) => String(a.submittedAt || '').localeCompare(String(b.submittedAt || '')),
          newest: (a, b) => String(b.submittedAt || '').localeCompare(String(a.submittedAt || '')),
          updated: (a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')),
          student: (a, b) => a.studentName.localeCompare(b.studentName),
        };
        list.sort(sorters[sort] || sorters.oldest);
        const totalFiltered = list.length;
        const pages = Math.max(1, Math.ceil(totalFiltered / pageSize));
        list = list.slice((page - 1) * pageSize, page * pageSize);
        return json({ stories: list.map((st) => ({ ...cloneStory(st), session: sessionOf(st) })), totalFiltered, page, pages, sessions: SESSIONS });
      }
      const adminStoryMatch = path.match(/\/api\/admin\/console\/stories\/([^/]+)(?:\/([^/]+))?$/);
      if (adminStoryMatch) {
        const story = findStory(decodeURIComponent(adminStoryMatch[1]));
        const op = adminStoryMatch[2];
        if (!story) return errorJson('P0002', 'Story not found.', 404);
        if (story.visibility !== 'mentor_visible' && !SUBMITTED_STATES.includes(story.status)) {
          return errorJson('P0002', 'Story not found.', 404);
        }
        if (op === 'review' && method === 'POST') {
          const patch = body?.patch || {};
          if (patch.status) { story.status = patch.status; story.statusChangedAt = new Date().toISOString(); pushHistory(story, 'story.status_changed', `to ${patch.status}`); }
          if (patch.mentorScore !== undefined && patch.mentorScore !== null) { story.mentorScore = Number(patch.mentorScore) || 0; pushHistory(story, 'story.evaluation_updated', `mentor score ${story.mentorScore}/5`); }
          if (patch.suitability !== undefined) story.reviewSuitability = patch.suitability || '';
          if (patch.studentFeedback) { story.feedback.push({ body: patch.studentFeedback, author_name: actorDisplay(), created_at: new Date().toISOString() }); story.feedbackSentAt = new Date().toISOString(); pushHistory(story, 'story.feedback_added', ''); }
          if (patch.internalNote) { story.internalNotes = story.internalNotes || []; story.internalNotes.push({ body: patch.internalNote, adminName: actorDisplay(), createdAt: new Date().toISOString() }); }
          story.reviewedAt = new Date().toISOString();
          story.reviewedByName = actorDisplay();
          story.reviewedByRole = 'admin';
          story.rowVersion += 1;
          return json({ story: cloneStory(story), feedback: story.feedback, internalNotes: story.internalNotes || [] });
        }
        if (op === 'taxonomy' && method === 'PATCH') {
          if (Array.isArray(body?.categories)) story.categories = body.categories.map(String);
          if (Array.isArray(body?.uses)) story.uses = body.uses.map(String);
          story.rowVersion += 1;
          return json({ story: cloneStory(story) });
        }
        return json({ story: cloneStory(story), feedback: story.feedback, revisions: story.revisions, reflections: story.reflections, craft: story.craft || {}, internalNotes: story.internalNotes || [] });
      }

      /* admin features / release controls */
      if (path.endsWith('/api/admin/features/admin_console')) {
        if (method === 'POST') return json({ flag: { scope: body?.scope || 'allowlist', updatedAt: new Date().toISOString() } });
        return json({ flag: { scope: 'allowlist', allowlist: ['(founder administrator)'], cohorts: [], updatedAt: days(6) } });
      }
      if (path.endsWith('/api/admin/features/voice_capture') && method === 'POST') {
        return json({ flag: { scope: body?.scope || 'eligible_all', allowlist: [], cohorts: [], updatedAt: new Date().toISOString() } });
      }
      if (path.endsWith('/api/admin/features')) {
        return json({ flag: { scope: 'eligible_all', allowlist: [], cohorts: [], updatedAt: days(6) }, audit: [{ previous: { scope: 'allowlist' }, current: { scope: 'eligible_all', allowlist: [], cohorts: [] }, createdAt: days(6) }] });
      }
      if (path.endsWith('/api/admin/voice/health')) {
        return json({ sessionsByState: [{ state: 'assembled', count: 3 }], errorsByCategory: [] });
      }
      if (path.endsWith('/api/admin/console/content-display')) {
        return json({ configuration: { payload: presentationPayload(), rowVersion: db.contentDisplay.rowVersion, updatedAt: db.contentDisplay.updatedAt } });
      }
      if (path.endsWith('/api/admin/console/content-display/validate')) {
        return json({ payload: body?.payload || presentationPayload() });
      }
      if (path.endsWith('/api/admin/console/content-display/publish')) {
        const payload = body?.payload || {};
        db.contentDisplay.taxonomy = payload.taxonomy || db.contentDisplay.taxonomy;
        db.contentDisplay.sections = payload.sections || db.contentDisplay.sections;
        db.contentDisplay.navigation = payload.navigation || db.contentDisplay.navigation;
        db.contentDisplay.b1513 = payload.b1513 || db.contentDisplay.b1513;
        db.contentDisplay.rowVersion += 1;
        db.contentDisplay.updatedAt = new Date().toISOString();
        return json({ configuration: { payload: presentationPayload(), rowVersion: db.contentDisplay.rowVersion, updatedAt: db.contentDisplay.updatedAt } });
      }
      if (path.endsWith('/api/admin/console/content-display/restore-defaults')) {
        db.contentDisplay.taxonomy = DEFAULT_TAXONOMY;
        db.contentDisplay.sections = DEFAULT_SECTIONS;
        db.contentDisplay.navigation = { interviewPrepVisible: false };
        db.contentDisplay.b1513 = b1513Presentation();
        db.contentDisplay.rowVersion += 1;
        db.contentDisplay.updatedAt = new Date().toISOString();
        return json({ configuration: { payload: presentationPayload(), rowVersion: db.contentDisplay.rowVersion, updatedAt: db.contentDisplay.updatedAt } });
      }
      if (path.endsWith('/api/admin/console/inspiration') && method === 'GET') {
        return json({ configuration: db.inspirationAdmin });
      }
      if (path.endsWith('/api/admin/console/inspiration/bulk-parse') && method === 'POST') {
        const lines = String(body?.csv || '').split(/\r?\n/).filter((l) => l.trim());
        const header = (lines[0] || '').toLowerCase();
        const hasHeader = header.includes('text');
        const dataLines = hasHeader ? lines.slice(1) : lines;
        const existing = new Set(db.inspirationAdmin.prompts.map((p) => p.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
        const validWho = ['you', 'family', 'someone_else'];
        const validDomain = ['personal', 'academic', 'medical_clinical'];
        const validEnergy = ['light', 'serious', 'moving'];
        const rows = dataLines.map((line, i) => {
          /* quote-aware CSV field split (handles commas inside quoted text and "" escapes) */
          const cols = [];
          let cur = '';
          let inQ = false;
          for (let ci = 0; ci < line.length; ci += 1) {
            const ch = line[ci];
            if (ch === '"') {
              if (inQ && line[ci + 1] === '"') { cur += '"'; ci += 1; } else inQ = !inQ;
            } else if (ch === ',' && !inQ) { cols.push(cur.trim()); cur = ''; } else cur += ch;
          }
          cols.push(cur.trim());
          const [text, who, domain, energy, territory, followUp, interviewUse] = cols;
          const errors = [];
          if (!text || text.length < 12) errors.push('question text missing or too short');
          if (!followUp) errors.push('follow-up required');
          if (who && !who.split('|').every((w) => validWho.includes(w))) errors.push(`unknown who: ${who}`);
          if (domain && !domain.split('|').every((w) => validDomain.includes(w))) errors.push(`unknown domain: ${domain}`);
          if (energy && !energy.split('|').every((w) => validEnergy.includes(w))) errors.push(`unknown energy: ${energy}`);
          const duplicate = text ? existing.has(text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()) : false;
          return { line: i + (hasHeader ? 2 : 1), ok: errors.length === 0 && !duplicate, duplicate, errors, prompt: { text, who: (who || 'you').split('|'), domain: (domain || 'personal').split('|'), energy: (energy || 'light').split('|'), territory: territory || '', followUp: followUp || '', interviewUse: interviewUse || '' } };
        });
        return json({ rows, summary: { total: rows.length, ok: rows.filter((r) => r.ok).length, duplicates: rows.filter((r) => r.duplicate).length, errors: rows.filter((r) => r.errors.length).length } });
      }
      if (path.endsWith('/api/admin/console/inspiration/bulk-commit') && method === 'POST') {
        /* P1-B fix: never trust client rows — re-validate server-side, and the
         * server-generated stable ID always wins (client ids are discarded, so
         * an existing question can never be shadowed or clobbered). */
        const existingNorm = new Set(db.inspirationAdmin.prompts.map((p) => p.text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()));
        const accepted = [];
        (Array.isArray(body?.rows) ? body.rows : []).forEach((r) => {
          const prompt = r?.prompt || {};
          const text = String(prompt.text || '');
          const followUp = String(prompt.followUp || '');
          if (text.length < 12 || !followUp) return;
          if (existingNorm.has(text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim())) return;
          accepted.push({
            text, followUp,
            who: (Array.isArray(prompt.who) ? prompt.who : ['you']).filter((w) => ['you', 'family', 'someone_else'].includes(w)),
            domain: (Array.isArray(prompt.domain) ? prompt.domain : ['personal']).filter((w) => ['personal', 'academic', 'medical_clinical'].includes(w)),
            energy: (Array.isArray(prompt.energy) ? prompt.energy : ['light']).filter((w) => ['light', 'serious', 'moving'].includes(w)),
            territory: String(prompt.territory || ''), interviewUse: String(prompt.interviewUse || ''),
            id: `q-imp-${db.auditSeq += 1}`, state: 'retired', imported: true, sortOrder: 1,
          });
          existingNorm.add(text.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim());
        });
        accepted.forEach((p) => db.inspirationAdmin.prompts.unshift(p));
        db.inspirationAdmin.rowVersion += 1;
        db.inspirationAdmin.updatedAt = new Date().toISOString();
        return json({ committed: accepted.length, configuration: db.inspirationAdmin, note: 'Saved as Retired drafts — publish each (or Publish imported) after preview. Never published directly from upload.' });
      }
      if (path.endsWith('/api/admin/console/inspiration/save') && method === 'POST') {
        const patch = body?.prompt;
        if (patch?.id) {
          const target = db.inspirationAdmin.prompts.find((p) => p.id === patch.id);
          if (target) Object.assign(target, patch); // incl. recommended toggle
          else db.inspirationAdmin.prompts.unshift({ ...patch, state: patch.state || 'active', sortOrder: 5 });
        }
        db.inspirationAdmin.rowVersion += 1;
        db.inspirationAdmin.updatedAt = new Date().toISOString();
        return json({ configuration: db.inspirationAdmin });
      }
    }

    /* -------- misc endpoints the production renderer may call -------- */
    if (path.endsWith('/api/students')) return json({ students: [] });
    if (path.endsWith('/api/questions') || path.includes('/api/questions?')) return json({ questions: [] });
    if (path.endsWith('/api/imports')) return json({ batches: [] });
    if (path.endsWith('/api/queue')) return json({ queue: [] });
    if (path.includes('/api/interview-intelligence')) return json({ intelligence: null });
    if (path.includes('/api/mentor/')) return json({});
    if (path.includes('/api/teaching/')) return json({ stories: [] });

    return errorJson('not_found', `Prototype backend has no handler for ${method} ${path}`, 404);
  }

  /* ================================================================
   * B1-513R ADDITIONS — Avatar Studio stand-ins, Request a Story,
   * Inspiration browse/favorites. All synthetic. The avatar images are
   * generated flat-illustration stand-ins for canonical MissionMed
   * Avatar Studio headshots/full-body renders (StoryForge CONSUMES
   * Avatar Studio in production; it never generates avatars).
   * ================================================================ */

  function b1513rAvatarSvg({ skin, hair, shirt, style = 'short', full = false }) {
    const hairShapes = {
      short: `<path d="M18 26c0-11 8-17 14-17s14 6 14 17l-2 4c0-8-5-12-12-12s-12 4-12 12z" fill="${hair}"/>`,
      long: `<path d="M17 27c0-12 8-18 15-18s15 6 15 18l1 16c-3 2-6 2-8 1l-1-13-14-1-1 14c-2 1-5 1-8-1z" fill="${hair}"/>`,
      curly: `<circle cx="22" cy="22" r="7" fill="${hair}"/><circle cx="32" cy="17" r="8" fill="${hair}"/><circle cx="42" cy="22" r="7" fill="${hair}"/><circle cx="27" cy="16" r="6" fill="${hair}"/><circle cx="37" cy="16" r="6" fill="${hair}"/>`,
      bald: `<path d="M20 24c1-9 6-14 12-14s11 5 12 14l-3 1c-1-6-4-9-9-9s-8 3-9 9z" fill="${hair}" opacity=".35"/>`,
      gray: `<path d="M18 27c0-11 8-17 14-17s14 6 14 17l-2 3c0-8-5-11-12-11s-12 3-12 11z" fill="#c9ccd6"/>`,
    };
    const bust = `
      <circle cx="32" cy="32" r="31" fill="#101624"/>
      <path d="M10 58c3-12 12-17 22-17s19 5 22 17a32 32 0 0 1-44 0z" fill="${shirt}"/>
      <rect x="27" y="36" width="10" height="9" rx="4" fill="${skin}"/>
      <circle cx="32" cy="27" r="12" fill="${skin}"/>
      ${hairShapes[style] || hairShapes.short}
      <circle cx="27.5" cy="27" r="1.4" fill="#1d2432"/><circle cx="36.5" cy="27" r="1.4" fill="#1d2432"/>
      <path d="M28 33c2.4 2 5.6 2 8 0" stroke="#1d2432" stroke-width="1.5" fill="none" stroke-linecap="round"/>`;
    const body = `
      <rect width="64" height="96" rx="8" fill="#101624"/>
      <circle cx="32" cy="20" r="10" fill="${skin}"/>
      ${(hairShapes[style] || hairShapes.short).replaceAll('cy="2', 'cy="1').replace('M18 26', 'M20 18').replace('M17 27', 'M19 19').replace('M20 24', 'M21 16')}
      <rect x="20" y="32" width="24" height="30" rx="9" fill="${shirt}"/>
      <rect x="24" y="62" width="7" height="24" rx="3.4" fill="#2a3348"/>
      <rect x="33" y="62" width="7" height="24" rx="3.4" fill="#2a3348"/>
      <rect x="14" y="34" width="7" height="22" rx="3.4" fill="${shirt}"/>
      <rect x="43" y="34" width="7" height="22" rx="3.4" fill="${shirt}"/>
      <circle cx="17.5" cy="58" r="3" fill="${skin}"/><circle cx="46.5" cy="58" r="3" fill="${skin}"/>`;
    const svg = full
      ? `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 96">${body}</svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">${bust}</svg>`;
    return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }

  const AVATAR_LOOKS = {
    'u-founder': { skin: '#e8b48c', hair: '#5a4632', shirt: '#2f6bb0', style: 'short' },
    'u-second': { skin: '#f0c9a0', hair: '#7c5a3a', shirt: '#3e7d5a', style: 'curly' },
    'u-mentor': { skin: '#e9bd97', hair: '#2e2a28', shirt: '#7c4bb0', style: 'long' },
    'u-mentor2': { skin: '#d9a06f', hair: '#241f1d', shirt: '#b0563e', style: 'long' },
    'u-mentor3': { skin: '#e6b285', hair: '#3c342c', shirt: '#4b6ab0', style: 'short' },
    'u-admin': { skin: '#e8b48c', hair: '#6b6f78', shirt: '#54607a', style: 'gray' },
    'u-st4': { skin: '#b57b4e', hair: '#1f1a17', shirt: '#a04e7c', style: 'curly' },
    'u-st5': { skin: '#c98d5e', hair: '#2b2320', shirt: '#3e8d7d', style: 'short' },
    'u-st6': { skin: '#e3ac7e', hair: '#171310', shirt: '#b07a3e', style: 'long' },
    'u-st7': { skin: '#f2d3af', hair: '#8a6a3c', shirt: '#4e7ca0', style: 'short' },
    'u-st8': { skin: '#d8a26e', hair: '#231d1a', shirt: '#7d5ab0', style: 'long' },
    'u-st9': { skin: '#eec39a', hair: '#3a3632', shirt: '#456b8c', style: 'short' },
    'u-st10': { skin: '#caa06a', hair: '#141110', shirt: '#8c4556', style: 'long' },
    'u-st11': { skin: '#a86a3e', hair: '#191412', shirt: '#3e6bb0', style: 'curly' },
    'u-st12': { skin: '#e9bd97', hair: '#4a3b2c', shirt: '#5a8c3e', style: 'bald' },
    'guest-rosa': { skin: '#dda878', hair: '#b9bfc9', shirt: '#96586d', style: 'gray' },
  };
  const AVATARS = {};
  Object.entries(AVATAR_LOOKS).forEach(([id, look]) => {
    AVATARS[id] = {
      headshot: b1513rAvatarSvg(look),
      fullBody: b1513rAvatarSvg({ ...look, full: true }),
      source: 'avatar_studio_synthetic_standin',
    };
  });
  // Maya deliberately has NO Avatar Studio asset — demonstrates the fallback + CREATE MY AVATAR path.
  function avatarFor(userId) { return AVATARS[userId] || null; }
  Object.values(USERS).forEach((account) => { account.user.avatar = avatarFor(account.user.id); });

  const CONTRIB_LIBRARY = /* __B1513R_CONTRIB_LIBRARY__ */ null;

  const INVITATIONS = {
    'u-founder': [
      { id: 'inv-1', token: 'rs-demo-rosa', contributorName: 'Rosa', relationship: 'parent', emailMasked: 'r•••@gmail.com', status: 'story_shared', sentAt: days(9), deliveredAt: days(9), linkVisitedAt: days(8), startedAt: days(8), contributedAt: days(7), expiresAt: days(-21), remindersSent: 1, videoGreeting: { state: 'recorded', durationMs: 21000 }, disclosureVersion: 'guest-contribution-1', personalMessage: 'Mom — I’m collecting stories for my residency applications. Anything you remember counts.' },
      { id: 'inv-2', token: 'rs-demo-ken', contributorName: 'Dr. Ito', relationship: 'mentor', emailMasked: 'k•••@univ.edu', status: 'link_visited', sentAt: days(4), deliveredAt: days(4), linkVisitedAt: days(2), expiresAt: days(-26), remindersSent: 0, videoGreeting: null, disclosureVersion: 'guest-contribution-1', personalMessage: '' },
      { id: 'inv-4', token: 'rs-demo-petro', contributorName: 'Uncle Petro', relationship: 'cousin', emailMasked: 'p•••@yahoo.com', status: 'bounced', sentAt: days(3), bouncedAt: days(3), bounceReason: 'Hard bounce — address not found', expiresAt: days(-27), remindersSent: 0, videoGreeting: null, disclosureVersion: 'guest-contribution-1', personalMessage: '' },
      { id: 'inv-3', token: 'rs-demo-sam', contributorName: 'Sam', relationship: 'best_friend', emailMasked: 's•••@outlook.com', status: 'delivered', sentAt: days(1), deliveredAt: days(1), expiresAt: days(-29), remindersSent: 0, videoGreeting: null, disclosureVersion: 'guest-contribution-1', personalMessage: '' },
    ],
  };
  const CONTRIBUTIONS = {
    'u-founder': [
      { id: 'ctr-1', invitationId: 'inv-1', contributorFirstName: 'Rosa', relationship: 'parent', kind: 'voice', durationMs: 94000, transcript: 'When Brian was nine, our neighbor Mrs. Duarte fell on the stairs. Every child ran to look. Brian ran to get a chair and a glass of water, and then he sat with her holding her hand until the ambulance came, telling her about his school day so she would think about something else. The paramedic asked him, are you the grandson? And he said, no sir, I am the neighbor. We still say it in this family — be the neighbor.', submittedAt: days(7), state: 'new', promptId: 'c-001', promptText: 'What is the first moment you remember thinking — this child is going to take care of people?' },
      { id: 'ctr-2', invitationId: 'inv-1', contributorFirstName: 'Rosa', relationship: 'parent', kind: 'text', transcript: 'He kept a notebook of every word his grandmother forgot, so he could remind her gently. He never told anyone. I found it under his bed years later.', submittedAt: days(7), state: 'favorite', promptId: 'c-003', promptText: 'What did {name} do as a child when someone in the house was sick?' },
    ],
  };
  const INSPIRATION_FAVORITES = { 'u-founder': ['q-012', 'q-046'] };
  const INSPIRATION_PINNED = { 'u-founder': [{ promptId: 'q-046', answeredStoryId: 's-102' }, { promptId: 'q-001', answeredStoryId: '' }, { promptId: 'q-035', answeredStoryId: '' }] };
  ['q-012', 'q-046', 'q-004'].forEach((id) => { const p = db.inspirationAdmin.prompts.find((x) => x.id === id); if (p) p.recommended = true; });

  async function routeR(method, path, body, init) {
    const authHeaderR = init?.headers?.Authorization || init?.headers?.authorization || '';
    const personaR = personaFromToken(authHeaderR.replace(/^Bearer\s+/i, '')) || currentPersona;
    if (personaR && USERS[personaR]) currentPersona = personaR;
    const me = USERS[currentPersona]?.user;

    /* ---- guest endpoints (magic-link surface; no StoryForge identity) ---- */
    const guestMatch = path.match(/\/api\/requests\/guest\/([^/]+)(?:\/([^/]+))?$/);
    if (guestMatch) {
      const token = decodeURIComponent(guestMatch[1]);
      const op = guestMatch[2];
      const owner = Object.entries(INVITATIONS).find(([, list]) => list.some((inv) => inv.token === token));
      if (!owner) return errorJson('invitation_invalid', 'This invitation link is not valid or has been revoked.', 404);
      const [ownerId, list] = owner;
      const invitation = list.find((inv) => inv.token === token);
      if (invitation.status === 'revoked') return errorJson('invitation_revoked', 'This invitation was cancelled by the student.', 410);
      if (!invitation.linkVisitedAt && !op) { invitation.linkVisitedAt = new Date().toISOString(); if (['sent', 'delivered'].includes(invitation.status)) invitation.status = 'link_visited'; }
      if (invitation.expiresAt && new Date(invitation.expiresAt).getTime() < Date.now()) {
        return errorJson('invitation_expired', 'This invitation has expired. Ask the student for a fresh one.', 410);
      }
      const student = Object.values(USERS).find((acc) => acc.user.id === ownerId)?.user;
      if (op === 'started' && method === 'POST') {
        if (!invitation.startedAt) { invitation.startedAt = new Date().toISOString(); if (invitation.status !== 'story_shared') invitation.status = 'started'; }
        return json({ ok: true });
      }
      if (op === 'contribution' && method === 'POST') {
        const already = (CONTRIBUTIONS[ownerId] || []).filter((c) => c.invitationId === invitation.id).length;
        if (already >= 3) return errorJson('invitation_complete', 'This invitation has reached its limit. Thank you for everything you shared.', 429);
        const contribution = {
          id: `ctr-${db.auditSeq += 1}`, invitationId: invitation.id,
          contributorFirstName: invitation.contributorName, relationship: invitation.relationship,
          kind: body?.kind === 'voice' ? 'voice' : 'text',
          durationMs: Math.min(30 * 60000, Number(body?.durationMs || 0)),
          /* P2-E fix: bound the unauthenticated token-write payload */
          transcript: String(body?.transcript || '').slice(0, 20000),
          submittedAt: new Date().toISOString(), state: 'new',
          promptId: String(body?.promptId || ''), promptText: String(body?.promptText || ''),
        };
        (CONTRIBUTIONS[ownerId] = CONTRIBUTIONS[ownerId] || []).unshift(contribution);
        invitation.status = 'story_shared';
        invitation.contributedAt = contribution.submittedAt;
        return json({ ok: true, thanks: `${student.first_name} will read this. Thank you.` });
      }
      const JOURNEYS = {
        parent: { line: 'You watched them become who they are. The small moments you remember are exactly what matters.', order: ['c-001','c-002','c-003','c-005','c-046','c-006','c-004','c-016','c-038','c-039','c-040','c-042'] },
        best_friend: { line: 'You know the version of them that exists outside medicine — that is the story programs never get to hear.', order: ['c-019','c-021','c-022','c-018','c-039','c-037','c-020','c-044','c-040','c-042','c-048'] },
        mentor: { line: 'You have seen how they learn, take feedback, and grow. One honest moment from you carries real weight.', order: ['c-030','c-027','c-028','c-029','c-047','c-031','c-045','c-039','c-040'] },
        faculty: { line: 'You have seen how they learn, take feedback, and grow. One honest moment from you carries real weight.', order: ['c-027','c-028','c-029','c-047','c-030','c-045','c-026','c-039','c-040'] },
      };
      const journey = JOURNEYS[invitation.relationship] || null;
      let prompts = (CONTRIB_LIBRARY?.prompts || []).filter((prompt) => prompt.rel.includes(invitation.relationship))
        .map((prompt) => ({ ...prompt, text: prompt.text.replaceAll('{name}', student.first_name), hint: (prompt.hint || '').replaceAll('{name}', student.first_name) }));
      if (journey) prompts = prompts.slice().sort((a, b) => { const ia = journey.order.indexOf(a.id); const ib = journey.order.indexOf(b.id); return (ia < 0 ? 99 : ia) - (ib < 0 ? 99 : ib); });
      return json({
        student: { first: student.first_name, headshot: avatarFor(ownerId)?.headshot || null, fullBody: avatarFor(ownerId)?.fullBody || null },
        invitation: { id: invitation.id, relationship: invitation.relationship, contributorName: invitation.contributorName, disclosureVersion: invitation.disclosureVersion, personalMessage: invitation.personalMessage, videoGreeting: invitation.videoGreeting },
        journeyLine: journey?.line || '',
        prompts: prompts.length ? prompts : (CONTRIB_LIBRARY?.prompts || []).slice(0, 6).map((prompt) => ({ ...prompt, text: prompt.text.replaceAll('{name}', student.first_name) })),
        disclosure: `You were invited by ${student.first_name} through MissionMed StoryForge. What you share goes to ${student.first_name}'s private story workspace, where ${student.first_name} may use it to prepare for residency and may share it with their MissionMed mentor. It is never public, other students never see it, and you can stop at any time. Nothing is saved until you press Send.`,
      });
    }

    if (!me) return undefined;

    /* ---- student Request-a-Story ---- */
    if (path.endsWith('/api/requests') && method === 'GET') {
      return json({ invitations: INVITATIONS[me.id] || [], contributions: CONTRIBUTIONS[me.id] || [], relationships: CONTRIB_LIBRARY?.relationships || [] });
    }
    if (path.endsWith('/api/requests') && method === 'POST') {
      /* P2-F fix: relationships come from the governed contributor library only */
      const validRels = new Set((CONTRIB_LIBRARY?.relationships || []).map((rel) => rel.id));
      if (!validRels.has(String(body?.relationship || ''))) {
        return errorJson('relationship_invalid', 'Choose who they are to you from the list.', 400);
      }
      const invitation = {
        id: `inv-${db.auditSeq += 1}`,
        // P1-1 fix: 128-bit CSPRNG token (production: CSPRNG + constant-time compare + IP rate limit)
        token: `rs-${Array.from(crypto.getRandomValues(new Uint8Array(16))).map((b) => b.toString(16).padStart(2, '0')).join('')}`,
        contributorName: String(body?.contributorName || 'Guest'), relationship: String(body?.relationship || 'best_friend'),
        emailMasked: String(body?.email || '').replace(/^(.).*(@.*)$/, '$1•••$2'),
        status: 'draft', createdAt: new Date().toISOString(),
        expiresAt: new Date(NOW + 30 * 86400000).toISOString(), remindersSent: 0,
        videoGreeting: null, disclosureVersion: 'guest-contribution-1',
        personalMessage: String(body?.personalMessage || ''),
      };
      (INVITATIONS[me.id] = INVITATIONS[me.id] || []).unshift(invitation);
      return json({ invitation });
    }
    const invMatch = path.match(/\/api\/requests\/([^/]+)\/([a-z-]+)$/);
    if (invMatch) {
      const invitation = (INVITATIONS[me.id] || []).find((inv) => inv.id === decodeURIComponent(invMatch[1]));
      if (!invitation) return errorJson('P0002', 'Invitation not found.', 404);
      const op = invMatch[2];
      if (op === 'send' || op === 'resend') {
        /* P1-C fix: bounced and revoked are terminal for this invitation.
         * A dead address can't be "fixed" by resending — the student creates a
         * fresh invitation (fresh token) with a corrected address. */
        if (['bounced', 'revoked'].includes(invitation.status)) {
          return errorJson('invitation_terminal', invitation.status === 'bounced'
            ? 'This address bounced. Create a fresh invitation with a corrected address — this link stays dead.'
            : 'This invitation was revoked. Create a fresh one if you change your mind.', 409);
        }
        if (invitation.status !== 'story_shared') invitation.status = 'sent';
        invitation.sentAt = new Date().toISOString();
        if (op === 'resend') invitation.remindersSent += 1;
        // Postmark-pattern simulation: API accept → delivery webhook (USCE-verified pattern)
        invitation.deliveredAt = new Date().toISOString();
        if (invitation.status === 'sent') invitation.status = 'delivered';
        return json({ invitation, delivery: { provider: 'postmark_simulated', stream: 'outbound', event: 'Delivery' } });
      }
      if (op === 'revoke') {
        /* Revoke-anytime is deliberate (pass-1 P1 fix). P2-D: record when, and
         * keep every already-received contribution — nothing a contributor gave
         * is lost when the link dies. */
        invitation.status = 'revoked';
        invitation.revokedAt = new Date().toISOString();
        return json({ invitation, note: 'Link dead immediately. Stories already received stay in your candidates.' });
      }
      if (op === 'update' && method === 'POST') {
        if (invitation.status !== 'draft') return errorJson('invitation_locked', 'Only a draft (never-sent) invitation can be edited.', 409);
        if (body?.contributorName !== undefined) invitation.contributorName = String(body.contributorName || invitation.contributorName);
        if (body?.relationship !== undefined) invitation.relationship = String(body.relationship || invitation.relationship);
        if (body?.email !== undefined) invitation.emailMasked = String(body.email || '').replace(/^(.).*(@.*)$/, '$1•••$2') || invitation.emailMasked;
        if (body?.personalMessage !== undefined) invitation.personalMessage = String(body.personalMessage || '');
        return json({ invitation });
      }
      if (op === 'email-preview') {
        const student = me;
        return json({ preview: {
          subject: `${student.first_name} asked for your help with a story`,
          body: `Hello ${invitation.contributorName},\n\n${student.first_name} is preparing for the next step in their medical career, and part of that is collecting real stories from the people who know them best.\n\n${invitation.personalMessage ? `A note from ${student.first_name}: “${invitation.personalMessage}”\n\n` : ''}It takes about two minutes. You don't need to write anything — you can simply talk, and StoryForge will write it down for you.\n\n[ HELP ${student.first_name.toUpperCase()} — TELL A STORY ]\n\nThis private link is only for you and expires ${new Date(invitation.expiresAt).toLocaleDateString()}. Whatever you share goes only to ${student.first_name}. Nothing is ever public.\n\nMissionMed StoryForge`,
          from: 'MissionMed StoryForge <storyforge@missionmedinstitute.com> (From identity to VERIFY at Codex time against the live Postmark server — USCE pattern: MMI Clinical Rotations <clinicals@missionmedinstitute.com>)',
          replyTo: 'To verify at Codex time — never assumed',
          note: 'Exact external wording requires Founder approval (FD-R2) before any real email is sent. Delivery uses MissionMed’s proven Postmark transactional pattern (triple-gated: ENABLED / DRY_RUN / LIVE_SEND; signed delivery webhooks).',
        } });
      }
      if (op === 'video-greeting') {
        invitation.videoGreeting = body?.remove ? null : { state: 'recorded', durationMs: Number(body?.durationMs || 20000) };
        return json({ invitation, note: 'Prototype state only — production stores via the deferred private Story Media design (force-off).' });
      }
    }
    const ctrMatch = path.match(/\/api\/contributions\/([^/]+)(?:\/([a-z-]+))?$/);
    if (ctrMatch) {
      const contribution = (CONTRIBUTIONS[me.id] || []).find((item) => item.id === decodeURIComponent(ctrMatch[1]));
      if (!contribution) return errorJson('P0002', 'Contribution not found.', 404);
      const op = ctrMatch[2];
      if (op === 'state' && method === 'PATCH') { contribution.state = String(body?.state || contribution.state); return json({ contribution }); }
      if (op === 'promote' && method === 'POST') {
        // P1-4 fix: contribution promotions start Private regardless of consent —
        // the contributor was promised a private destination; the student widens per story.
        const story = {
          id: `s-ctr-${db.auditSeq += 1}`, studentId: me.id, studentName: me.display_name,
          title: String(body?.title || `${contribution.contributorFirstName}'s story about me`).replace(/^The One Where\s*/i, ''),
          prefixEnabled: true,
          originalTitle: String(body?.title || 'A story about me'),
          originalText: contribution.transcript, text: contribution.transcript, lesson: String(body?.lesson || ''),
          status: 'private', revised: false, studentScore: 0, mentorScore: 0, reviewSuitability: '',
          studentStar: false, mentorStar: false, themes: [], categories: [], uses: [], birds: [], positions: [],
          rowVersion: 1, captureType: contribution.kind === 'voice' ? 'audio' : 'text',
          createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
          audio: contribution.kind === 'voice' ? { id: `aud-ctr-${db.auditSeq}`, durationMs: AUDIO_MS } : null,
          audioAssetId: contribution.kind === 'voice' ? `aud-ctr-${db.auditSeq}` : '', audioDurationMs: contribution.kind === 'voice' ? AUDIO_MS : 0,
          visibility: 'private', visibilityChangedAt: new Date().toISOString(),
          origin: { type: 'contribution', invitationId: contribution.invitationId, contributorRelationship: contribution.relationship, contributorFirstName: contribution.contributorFirstName },
          versions: {}, feedback: [], mentorNotes: [], media: [], revisions: [], reflections: [], mappings: [], questionCount: 0, useSuggestions: [],
          history: [],
        };
        pushHistory(story, 'story.captured', `promoted from a Request-a-Story contribution by ${contribution.contributorFirstName} (${contribution.relationship})`);
        db.stories.unshift(story);
        contribution.state = 'promoted';
        contribution.promotedStoryId = story.id;
        return json({ story: cloneStory(story), contribution });
      }
    }

    /* ---- Inspiration browse + favorites ---- */
    if (path.includes('/api/inspiration/browse')) {
      const url = new URL(path, SAFE_ORIGIN);
      const q = (url.searchParams.get('q') || '').toLowerCase();
      const who = url.searchParams.get('who') || '';
      const domain = url.searchParams.get('domain') || '';
      const energy = url.searchParams.get('energy') || '';
      const favOnly = url.searchParams.get('fav') === '1';
      const favorites = new Set(INSPIRATION_FAVORITES[me.id] || []);
      let prompts = db.inspirationAdmin.prompts.filter((prompt) => prompt.state === 'active');
      if (q) prompts = prompts.filter((prompt) => `${prompt.text} ${prompt.territory}`.toLowerCase().includes(q));
      if (who) prompts = prompts.filter((prompt) => prompt.who?.includes(who));
      if (domain) prompts = prompts.filter((prompt) => prompt.domain?.includes(domain));
      if (energy) prompts = prompts.filter((prompt) => prompt.energy?.includes(energy));
      if (favOnly) prompts = prompts.filter((prompt) => favorites.has(prompt.id));
      const pinned = INSPIRATION_PINNED[me.id] || [];
      const pinnedIds = new Set(pinned.map((p) => p.promptId));
      const answeredByPrompt = new Map(db.stories.filter((st) => st.studentId === me.id && st.origin?.type === 'inspiration').map((st) => [st.origin.promptId, st.id]));
      return json({
        prompts: prompts.map((prompt) => ({ ...prompt, favorite: favorites.has(prompt.id), pinned: pinnedIds.has(prompt.id), answeredStoryId: answeredByPrompt.get(prompt.id) || '' })),
        total: prompts.length, favoriteCount: favorites.size,
        /* P1-A fix: pinned[] serves only prompts a student may see (state active) —
         * a retired/unpublished draft never leaks through the pin path. */
        pinned: pinned.map((p) => { const src = db.inspirationAdmin.prompts.find((x) => x.id === p.promptId && x.state === 'active'); return src ? { ...src, favorite: favorites.has(src.id), pinned: true, answeredStoryId: answeredByPrompt.get(src.id) || p.answeredStoryId || '' } : null; }).filter(Boolean),
      });
    }
    const pinMatch = path.match(/\/api\/inspiration\/pin\/([^/]+)$/);
    if (pinMatch && method === 'POST') {
      const id = decodeURIComponent(pinMatch[1]);
      const list = INSPIRATION_PINNED[me.id] = INSPIRATION_PINNED[me.id] || [];
      const idx = list.findIndex((p) => p.promptId === id);
      /* P1-A fix: only an ACTIVE (published) question can be pinned. */
      if (idx < 0 && !db.inspirationAdmin.prompts.some((x) => x.id === id && x.state === 'active')) {
        return errorJson('prompt_not_available', 'That question is not available.', 404);
      }
      if (idx >= 0) list.splice(idx, 1); else list.push({ promptId: id, answeredStoryId: '' });
      return json({ pinned: idx < 0, order: list.map((p) => p.promptId) });
    }
    if (path.endsWith('/api/inspiration/pin-order') && method === 'POST') {
      const order = (body?.ids || []).map(String);
      const list = INSPIRATION_PINNED[me.id] = INSPIRATION_PINNED[me.id] || [];
      list.sort((a, b) => order.indexOf(a.promptId) - order.indexOf(b.promptId));
      return json({ order: list.map((p) => p.promptId) });
    }
    const favMatch = path.match(/\/api\/inspiration\/favorite\/([^/]+)$/);
    if (favMatch && method === 'POST') {
      const id = decodeURIComponent(favMatch[1]);
      const list = INSPIRATION_FAVORITES[me.id] = INSPIRATION_FAVORITES[me.id] || [];
      const index = list.indexOf(id);
      if (index >= 0) list.splice(index, 1); else list.push(id);
      return json({ favorite: index < 0, favorites: list });
    }

    return undefined;
  }

  /* ---------- fetch interceptor ---------- */
  const realFetch = window.fetch.bind(window);
  window.fetch = async function b1513Fetch(input, init = {}) {
    const url = typeof input === 'string' ? input : (input?.url || String(input));
    let parsed;
    try {
      parsed = new URL(url, SAFE_ORIGIN + '/');
    } catch {
      return realFetch(input, init);
    }
    if (!parsed.pathname.includes('/api/') && !parsed.href.includes('/api/')) {
      return realFetch(input, init);
    }
    const method = (init.method || 'GET').toUpperCase();
    let body = init.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch { /* keep raw */ }
    }
    try {
      const headers = {};
      if (init.headers) {
        Object.entries(init.headers).forEach(([k, v]) => { headers[k] = v; });
      }
      const responseR = await routeR(method, parsed.pathname + parsed.search, body, { ...init, headers });
      if (responseR) return responseR;
      const response = await route(method, parsed.pathname + parsed.search, body, { ...init, headers });
      return response || new Response('{}', { status: 200, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
      console.error('[B1-513 prototype backend]', error);
      return new Response(JSON.stringify({ code: 'prototype_backend_error', message: String(error?.message || error) }), { status: 500, headers: { 'Content-Type': 'application/json' } });
    }
  };

  /* ---------- auto-login as Founder for review convenience ---------- */
  try {
    if (!sessionStorage.getItem('storyforge_local_fixture_persona')) {
      sessionStorage.setItem('storyforge_local_fixture_persona', 'founderStudent');
    }
  } catch { /* sessionStorage unavailable — login screen will show */ }

  window.__B1513 = { db, USERS, DIRECTORY, CONSENT_POLICY, PROMPT_LIBRARY, audioUrl };
  /* B1-513R prototype shortcut: production delivers avatar references inside
   * each payload (session/directory/review attribution). The prototype exposes
   * the synthetic Avatar Studio stand-ins directly for the extension layer. */
  window.__B1513R = { AVATARS, avatarFor, CONTRIB_LIBRARY, INVITATIONS, CONTRIBUTIONS };
}());
