import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

import { expect } from '@playwright/test';

import {
  CANONICAL_RELATIVE_PATH,
  CANONICAL_SHA256,
  PRODUCT_SURFACES,
} from '../authority-contract.mjs';

const packageDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..', '..');
const repositoryDir = path.resolve(packageDir, '..');
export const canonicalFile = path.join(repositoryDir, ...CANONICAL_RELATIVE_PATH);

const FIXED_NOW = '2026-07-26T13:30:00-04:00';

function escaped(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export function authHeaders(token) {
  return { Authorization: `Bearer ${token}` };
}

export async function devToken(request, persona) {
  const response = await request.post(`/api/dev/session/${persona}`, { data: {} });
  expect(response.ok(), `fixture token for ${persona}`).toBeTruthy();
  return (await response.json()).token;
}

export async function seedConformanceData(request) {
  const [student, mentor, mentorTwo, admin] = await Promise.all([
    devToken(request, 'student'),
    devToken(request, 'mentor'),
    devToken(request, 'mentorTwo'),
    devToken(request, 'admin'),
  ]);
  const presentation = await request.get('/api/presentation', {
    headers: authHeaders(student),
  });
  expect(presentation.ok(), 'read B1-512 conformance presentation').toBeTruthy();
  const configuration = (await presentation.json()).configuration;
  if (!configuration.payload.navigation.interviewPrepVisible) {
    const published = await request.post('/api/admin/console/content-display/publish', {
      headers: authHeaders(admin),
      data: {
        expectedVersion: Number(configuration.version),
        payload: {
          ...configuration.payload,
          navigation: { interviewPrepVisible: true },
        },
      },
    });
    expect(published.ok(), 'enable Interview Prep for its canonical conformance surfaces')
      .toBeTruthy();
  }
  const create = async (title, text, themes = []) => {
    const response = await request.post('/api/stories', {
      headers: authHeaders(student),
      data: {
        title,
        text,
        themes,
        captureType: 'text',
        surface: 'quick',
      },
    });
    expect(response.status(), `create ${title}`).toBe(201);
    return (await response.json()).story;
  };

  const privateStory = await create(
    'Conformance Private Draft',
    'During rounds I noticed the family had not been invited into the decision. I paused, asked what mattered to them, and documented the choice we made together.',
  );
  const reviewStory = await create(
    'Conformance Revision Story',
    'A patient was being discussed as a diagnosis rather than a person. I asked the team to pause and name the goal the patient had already shared with us.',
  );
  const submittedStory = await create(
    'Conformance Awaiting Review',
    'The plan was drifting because no one had restated the decision. I summarized the options, named the risk, and asked the senior resident to confirm the next step.',
    ['patient'],
  );

  for (const story of [reviewStory, submittedStory]) {
    const submitted = await request.post(`/api/stories/${story.id}/submit`, {
      headers: authHeaders(student),
      data: { surface: 'workspace' },
    });
    expect(submitted.ok(), `submit ${story.title}`).toBeTruthy();
  }

  const opened = await request.post(`/api/stories/${reviewStory.id}/open`, {
    headers: authHeaders(mentor),
    data: { surface: 'quick' },
  });
  expect(opened.ok(), 'mentor opens revision story').toBeTruthy();
  const needsRevision = await request.post(`/api/stories/${reviewStory.id}/review`, {
    headers: authHeaders(mentor),
    data: {
      feedback: 'Protect the decision point and say what changed because you spoke up.',
      status: 'needs_revision',
      mentorScore: 4,
      needsFollowup: true,
      classification: 'clinical',
      surface: 'workspace',
    },
  });
  expect(needsRevision.ok(), 'mentor requests revision').toBeTruthy();

  const updated = await request.patch(`/api/stories/${reviewStory.id}`, {
    headers: authHeaders(student),
    data: {
      title: reviewStory.title,
      text: `${reviewStory.current_text || reviewStory.text} The team changed the plan, and I learned to make the patient’s goal explicit before discussing options.`,
      studentScore: 5,
      uses: ['iv', 'ps'],
      surface: 'workspace',
    },
  });
  expect(updated.ok(), 'student revises story').toBeTruthy();
  const openedAgain = await request.post(`/api/stories/${reviewStory.id}/open`, {
    headers: authHeaders(mentorTwo),
    data: { surface: 'quick' },
  });
  expect(openedAgain.ok(), 'second mentor opens revision').toBeTruthy();
  const approved = await request.post(`/api/stories/${reviewStory.id}/review`, {
    headers: authHeaders(mentorTwo),
    data: {
      feedback: 'Approved. The revision now preserves the action, result, and durable lesson.',
      status: 'approved',
      mentorScore: 5,
      needsFollowup: false,
      classification: 'clinical',
      surface: 'workspace',
    },
  });
  expect(approved.ok(), 'second mentor approves revision').toBeTruthy();

  const questionsResponse = await request.get('/api/questions', {
    headers: authHeaders(student),
  });
  expect(questionsResponse.ok(), 'load canonical interview questions').toBeTruthy();
  const question = (await questionsResponse.json()).questions
    .find((item) => item.canonical_key === 'q16');
  expect(question, 'canonical q16 clinical-decision question').toBeTruthy();

  const pairResponse = await request.post('/api/story-question-pairs', {
    headers: authHeaders(student),
    data: {
      storyId: reviewStory.id,
      questionId: question.id,
      studentStrength: 4,
      why: 'The story makes the decision point, student action, result, and lesson explicit.',
      clinical: true,
      surface: 'workshop',
    },
  });
  const pairPayload = await pairResponse.json();
  expect(
    pairResponse.status(),
    `student maps revision story to q16: ${JSON.stringify(pairPayload)}`,
  ).toBe(201);
  const pair = pairPayload.pair;

  const confirmedPair = await request.post(`/api/story-question-pairs/${pair.id}/confirm`, {
    headers: authHeaders(mentor),
    data: { surface: 'workshop' },
  });
  expect(confirmedPair.ok(), 'mentor confirms q16 story mapping').toBeTruthy();

  const scoredPair = await request.patch(`/api/story-question-pairs/${pair.id}`, {
    headers: authHeaders(mentor),
    data: {
      mentorStrength: 5,
      surface: 'workshop',
    },
  });
  expect(scoredPair.ok(), 'mentor scores q16 story mapping').toBeTruthy();

  const followupResponse = await request.post('/api/pair-followups', {
    headers: authHeaders(student),
    data: {
      pairId: pair.id,
      text: 'What information changed your decision?',
      clinical: true,
      prepared: false,
      note: '',
      surface: 'workshop',
    },
  });
  expect(followupResponse.status(), 'student maps a natural q16 follow-up').toBe(201);

  return Object.freeze({
    privateStory,
    reviewStory,
    submittedStory,
    pair,
    question,
    tokens: Object.freeze({ student, mentor, mentorTwo }),
  });
}

export async function assertCanonicalAuthority() {
  const bytes = await readFile(canonicalFile);
  const actual = createHash('sha256').update(bytes).digest('hex');
  expect(actual, 'Founder-approved canonical StoryForge V5 SHA-256').toBe(CANONICAL_SHA256);
}

export async function installDeterminism(page) {
  await page.addInitScript(({ fixedNow }) => {
    const NativeDate = Date;
    const fixed = new NativeDate(fixedNow).getTime();
    class FixedDate extends NativeDate {
      constructor(...args) {
        super(...(args.length ? args : [fixed]));
      }

      static now() {
        return fixed;
      }
    }
    Object.setPrototypeOf(FixedDate, NativeDate);
    window.Date = FixedDate;

    let randomState = 0x503b1501;
    Math.random = () => {
      randomState = (Math.imul(randomState, 1664525) + 1013904223) >>> 0;
      return randomState / 0x1_0000_0000;
    };

    try {
      localStorage.clear();
      sessionStorage.clear();
    } catch {
      // A fresh browser context is already isolated if file storage is unavailable.
    }
  }, { fixedNow: FIXED_NOW });
}

export async function settle(page) {
  await page.waitForLoadState('domcontentloaded');
  await page.evaluate(async () => {
    if (document.fonts?.ready) await document.fonts.ready;
  });
  await page.waitForTimeout(120);
}

export async function openCanonicalPage(
  browser,
  viewport = { width: 1440, height: 1000 },
) {
  const context = await browser.newContext({
    viewport,
    locale: 'en-US',
    timezoneId: 'America/New_York',
    colorScheme: 'dark',
    reducedMotion: 'reduce',
  });
  const page = await context.newPage();
  await installDeterminism(page);
  await page.goto(pathToFileURL(canonicalFile).href, { waitUntil: 'load' });
  await page.waitForSelector('#main section[data-view="home"]');
  await settle(page);
  return { context, page };
}

async function canonicalRole(page, role) {
  await page.evaluate((nextRole) => {
    const desired = nextRole === 'mentor' ? 'advisor' : 'student';
    if (S.role !== desired) switchRole(desired);
  }, role);
}

export async function openCanonicalSurface(page, surfaceKey) {
  const contract = PRODUCT_SURFACES[surfaceKey];
  await canonicalRole(page, contract.role);

  await page.evaluate(({ kind, route, role, surfaceKey: key }) => {
    if (kind === 'route') {
      S.view = route;
      render();
      return;
    }
    if (kind === 'capture') {
      openCapture();
      return;
    }
    if (kind === 'quick-look') {
      S.view = 'library';
      render();
      const story = STORIES.find((item) => (
        item.comments?.length
        && item.qa?.length
        && item.birds?.length
      )) || STORIES.find((item) => item.shared) || STORIES[0];
      openQuick(story.id, STORIES.map((item) => item.id));
      return;
    }
    if (kind === 'quick-review') {
      const stories = shared(MENTOR.cur);
      const story = stories.find((item) => item.comments?.length || item.qa?.length) || stories[0];
      openQuick(story.id, stories.map((item) => item.id));
      return;
    }
    if (kind === 'question-workshop') {
      S.view = 'prep';
      render();
      const control = document.querySelector('[data-qshop]');
      if (control) control.click();
      return;
    }
    if (kind === 'story') {
      const stories = role === 'mentor' ? shared(MENTOR.cur) : STORIES;
      const story = (
        role === 'mentor'
          ? stories.find((item) => item.comments?.length || item.refl?.length)
          : key === 'story_builder'
            ? stories.find((item) => item.status === 'private')
            : stories.find((item) => (
              item.comments?.length
              && item.qa?.length
              && item.birds?.length
              && item.uses?.length
            ))
      ) || stories[0];
      openRoom(story.id);
      if (key === 'story_builder') {
        S.roomTab = 'polish';
        renderRoom();
      }
      return;
    }
    if (kind === 'mentor-student') {
      MENTOR.cur = stuById('maya') || STUDENTS[0];
      S.view = 'mstudent';
      render();
      return;
    }
    if (kind === 'teaching') {
      MENTOR.cur = stuById('maya') || STUDENTS[0];
      S.view = 'mhome';
      render();
      openTeach(MENTOR.cur.id, null, true);
      return;
    }
    if (kind === 'session') {
      MENTOR.cur = stuById('maya') || STUDENTS[0];
      S.view = 'mstudent';
      render();
      startSesh(MENTOR.cur);
    }
  }, { ...contract, surfaceKey });

  // B1-510 makes the existing Learning Lesson body permanently visible and
  // removes its dead disclosure control. Compare that authorized state with
  // the same pre-existing canonical body expanded, without weakening any
  // global conformance threshold or changing the canonical artifact.
  if (surfaceKey === 'quick_capture') {
    await page.evaluate(() => {
      document.querySelector('#capture .capMore')?.classList.add('open');
    });
  }

  const selector = {
    route: '#main section',
    capture: '#capture.open',
    story: '#room.open',
    'quick-look': '#quick.open',
    'quick-review': '#quick.open',
    'question-workshop': '#main section[data-view="qshop"]',
    'mentor-student': '#main section[data-view="mstudent"]',
    teaching: '#teach.open',
    session: '#sesh.on',
  }[contract.kind];
  if (selector) await page.waitForSelector(selector);
  await settle(page);
}

function personaLabel(persona) {
  return {
    student: /Student\s*·\s*Maya/i,
    mentor: /Mentor\s*·\s*Dr\.?\s*Chen/i,
  }[persona];
}

export async function loginCandidate(page, role) {
  const persona = role === 'mentor' ? 'mentor' : 'student';
  await installDeterminism(page);
  await page.goto('/', { waitUntil: 'domcontentloaded' });

  const dataControl = page.locator(
    `[data-persona="${persona}"], [data-fixture-persona="${persona}"]`,
  ).first();
  if (await dataControl.count()) {
    await dataControl.click();
  } else {
    await page.getByRole('button', { name: personaLabel(persona) }).first().click();
  }
  await page.waitForFunction(() => (
    !document.body.classList.contains('is-booting')
    && Boolean(document.querySelector('#main section'))
  ));
  await settle(page);
}

async function candidateNavigate(page, route) {
  if (route === 'qlib') {
    await candidateNavigate(page, 'prep');
    const libraryControl = page.locator('[data-nav="qlib"]').first();
    await expect(
      libraryControl,
      'production Question Library navigation control',
    ).toBeVisible();
    await libraryControl.click();
    await page.waitForSelector('#main section[data-view="qlib"]');
    await settle(page);
    return;
  }
  const candidateRoute = {
    mhome: 'home',
    mstudents: 'students',
    mqueue: 'queue',
    mactivity: 'activity',
  }[route] || route;
  const candidateView = {
    mhome: 'mhome',
    mstudents: 'mstudents',
    mqueue: 'mqueue',
    mactivity: 'mactivity',
    students: 'mstudents',
    queue: 'mqueue',
    activity: 'mactivity',
  }[route] || candidateRoute;
  const control = page.locator(`[data-nav="${candidateRoute}"]`).first();
  await expect(
    control,
    `production navigation control for ${route}`,
  ).toBeVisible();
  await control.click();
  await page.waitForSelector(`#main section[data-view="${candidateView}"]`);
  await settle(page);
}

async function openCandidateMentorStudent(page, seed) {
  await candidateNavigate(page, 'mstudents');
  const studentId = String(
    seed?.reviewStory?.student_id
    || seed?.reviewStory?.studentId
    || '',
  );
  const exactControl = studentId
    ? page.locator(`[data-open-student="${studentId}"]`).first()
    : null;
  const namedControl = page.locator('[data-open-student]')
    .filter({ hasText: /Maya/i })
    .first();
  const control = exactControl && await exactControl.count()
    ? exactControl
    : await namedControl.count()
      ? namedControl
      : page.locator('[data-open-student]').first();
  await expect(
    control,
    'production mentor student workspace control',
  ).toBeVisible();
  await control.click();
  await page.waitForSelector('#main section[data-view="mstudent"]');
  await settle(page);
}

async function openStoryFromRows(page, title = '') {
  const titledRow = title
    ? page.locator('[data-story-row]').filter({ hasText: title }).first()
    : null;
  if (titledRow && await titledRow.count()) {
    const control = titledRow.locator('[data-open-story]').first();
    if (await control.count()) {
      await control.click();
      return true;
    }
  }
  const control = page.locator('[data-open-story]').first();
  if (await control.count()) {
    await control.click();
    return true;
  }
  return false;
}

export async function openCandidateSurface(page, surfaceKey, seed) {
  const contract = PRODUCT_SURFACES[surfaceKey];
  await loginCandidate(page, contract.role);

  if (contract.kind === 'route') {
    await candidateNavigate(page, contract.candidateRoute || contract.route);
  } else if (contract.kind === 'capture') {
    const control = page.locator('[data-open-capture]').first();
    if (await control.count()) await control.click();
  } else if (contract.kind === 'quick-look') {
    await candidateNavigate(page, 'library');
    const titledRow = page.locator('[data-story-row]')
      .filter({ hasText: seed?.reviewStory?.title || '' })
      .first();
    const control = (
      await titledRow.count()
        ? titledRow.locator('[data-open-quick]').first()
        : page.locator('[data-open-quick]').first()
    );
    await expect(control, 'production Quick Look control').toBeVisible();
    await control.click();
    await page.waitForSelector('#quick.open [role="dialog"]');
  } else if (contract.kind === 'question-workshop') {
    await candidateNavigate(page, 'prep');
    const control = page.locator(
      seed?.question?.id
        ? `[data-open-workshop="${seed.question.id}"]`
        : '[data-open-workshop]',
    ).first();
    if (await control.count()) await control.click();
  } else if (contract.kind === 'quick-review') {
    await candidateNavigate(page, 'queue');
    const titledRow = page.locator('[data-story-row]')
      .filter({ hasText: seed?.submittedStory?.title || '' })
      .first();
    const control = (
      await titledRow.count()
        ? titledRow.locator('[data-open-quick]').first()
        : page.locator('[data-open-quick]').first()
    );
    if (await control.count()) await control.click();
  } else if (contract.kind === 'mentor-student') {
    await openCandidateMentorStudent(page, seed);
  } else if (contract.kind === 'teaching') {
    await openCandidateMentorStudent(page, seed);
    const control = page.locator('[data-open-teaching]').first();
    await expect(control, 'production Teaching Mode control').toBeVisible();
    await control.click();
    await page.waitForSelector('#teach.open [role="dialog"]');
  } else if (contract.kind === 'session') {
    await openCandidateMentorStudent(page, seed);
    const control = page.locator('[data-start-session]').first();
    await expect(control, 'production 1:1 session control').toBeVisible();
    await control.click();
    await page.waitForSelector('#sesh.on');
  } else if (contract.kind === 'story') {
    if (contract.role === 'mentor') {
      await candidateNavigate(page, 'queue');
      await openStoryFromRows(page, seed?.submittedStory?.title);
    } else {
      await candidateNavigate(page, 'library');
      const title = surfaceKey === 'story_builder'
        ? seed?.privateStory?.title
        : seed?.reviewStory?.title;
      await openStoryFromRows(page, title);
    }
  }
  if (surfaceKey === 'story_builder') {
    const workingVersion = page.locator('#room.open [data-story-tab="working"]').first();
    await workingVersion.waitFor({ state: 'visible' });
    await workingVersion.click();
  }
  await settle(page);
}

export async function assertMarkers(page, surfaceKey, options = {}) {
  const contract = PRODUCT_SURFACES[surfaceKey];
  const bodyText = await page.locator('body').innerText();
  const superseded = new Set(
    options.production ? (contract.flagOffSupersededMarkers || []) : [],
  );
  for (const marker of contract.markers.filter((item) => !superseded.has(item))) {
    const expectedMarker = options.production
      ? (contract.productionMarkerAliases?.[marker] || marker)
      : marker;
    const matcher = options.soft ? expect.soft : expect;
    matcher(bodyText, `${contract.label}: ${marker}`)
      .toMatch(new RegExp(escaped(expectedMarker), 'i'));
  }
  if (options.production && contract.forbiddenMarkers) {
    for (const marker of contract.forbiddenMarkers) {
      const matcher = options.soft ? expect.soft : expect;
      await matcher(
        bodyText,
        `${contract.label}: production excludes ${marker}`,
      ).not.toMatch(new RegExp(escaped(marker), 'i'));
    }
  }
  if (options.production) {
    for (const marker of superseded) {
      const matcher = options.soft ? expect.soft : expect;
      await matcher(
        bodyText,
        `${contract.label}: flag-off production excludes ${marker}`,
      ).not.toMatch(new RegExp(escaped(marker), 'i'));
    }
  }
}

const VISUAL_COMPARISON_THRESHOLDS = Object.freeze({
  maxDocumentOverflowPx: 2,
  maxSurfaceEdgeOverflowPx: 2,
  maxNormalizedSurfaceLeftDelta: 0.12,
  maxNormalizedSurfaceTopDelta: 0.15,
  maxNormalizedSurfaceWidthDelta: 0.16,
  minComponentClassJaccard: 0.42,
  defaultMinTopologyJaccard: 0.3,
  minVisualStyleJaccard: 0.28,
  minNonMarkerStructuralComposite: 0.38,
  minMarkerGeometryCoverage: 0.9,
  minMarkerVisualSimilarity: 0.56,
  maxRgbHistogramDistance: 0.42,
  maxTileLuminanceDistance: 0.22,
  maxMeanLuminanceDelta: 0.13,
  maxDarkPixelRatioDelta: 0.2,
  maxMeanSaturationDelta: 0.18,
  maxEdgeEnergyDelta: 0.13,
});

const STRUCTURE_WEIGHTS = Object.freeze({
  componentClasses: 0.45,
  topology: 0.2,
  visualStyles: 0.35,
});

// Repeated fixture rows legitimately differ between the canonical demo and the
// truthful PostgreSQL candidate. These lower per-surface floors are calibrated
// from the known-good direct comparison; class/style floors and the non-marker
// composite remain mandatory, so marker text alone can never pass the gate.
const TOPOLOGY_MINIMUMS = Object.freeze({
  // B1-514's Founder-approved full-width progression HUD and recommendation
  // module intentionally add Home topology while preserving the V5 shell,
  // marker geometry, component vocabulary, style, and palette gates.
  home: 0.20,
  interview_prep: 0.12,
  library: 0.26,
  mentor: 0.23,
  mentor_students: 0.14,
  my_activity: 0.28,
  notifications: 0.03,
  question_coverage: 0.19,
  quick_capture: 0.14,
  review_queue: 0.25,
  // B1-514 adds first-class theme cards and two approved environments while
  // retaining every V5 Settings marker and the remaining visual gates.
  settings: 0.13,
});

function candidateView(contract) {
  return {
    students: 'mstudents',
    queue: 'mqueue',
    activity: 'mactivity',
  }[contract.candidateRoute] || contract.route;
}

function surfaceSelector(surfaceKey, production) {
  const contract = PRODUCT_SURFACES[surfaceKey];
  return {
    route: `#main section[data-view="${production ? candidateView(contract) : contract.route}"]`,
    story: '#room.open .roomSheet, #room.open [role="dialog"]',
    capture: '#capture.open .capSheet, #capture.open [role="dialog"]',
    'quick-look': '#quick.open .drawer, #quick.open [role="dialog"]',
    'quick-review': '#quick.open .drawer, #quick.open [role="dialog"]',
    'question-workshop': '#main section[data-view="qshop"]',
    'mentor-student': '#main section[data-view="mstudent"]',
    teaching: '#teach.open',
    session: '#sesh.on',
  }[contract.kind];
}

async function pageEvidence(page, surfaceKey, production) {
  const contract = PRODUCT_SURFACES[surfaceKey];
  const selector = surfaceSelector(surfaceKey, production);
  return page.evaluate(({
    markers,
    selector: activeSelector,
    activeSurfaceKey,
    isProduction,
    flagOffSupersededMarkers,
  }) => {
    const visible = (element) => {
      if (!element) return false;
      const style = getComputedStyle(element);
      const box = element.getBoundingClientRect();
      return style.display !== 'none'
        && style.visibility !== 'hidden'
        && style.opacity !== '0'
        && box.width > 0
        && box.height > 0;
    };

    const rect = (element) => {
      if (!element) return null;
      const box = element.getBoundingClientRect();
      return {
        x: Number(box.x.toFixed(2)),
        y: Number(box.y.toFixed(2)),
        width: Number(box.width.toFixed(2)),
        height: Number(box.height.toFixed(2)),
        right: Number(box.right.toFixed(2)),
        bottom: Number(box.bottom.toFixed(2)),
      };
    };

    const firstFont = (value) => String(value || '')
      .split(',')[0]
      .replace(/["']/g, '')
      .trim()
      .toLowerCase();

    const styleSnapshot = (element) => {
      if (!element) return null;
      const style = getComputedStyle(element);
      return {
        fontFamily: firstFont(style.fontFamily),
        fontSize: Number.parseFloat(style.fontSize) || 0,
        fontWeight: Number.parseInt(style.fontWeight, 10) || 400,
        lineHeight: Number.parseFloat(style.lineHeight) || 0,
        color: style.color,
        backgroundColor: style.backgroundColor,
        borderRadius: Number.parseFloat(style.borderRadius) || 0,
        display: style.display,
      };
    };

    const median = (values) => {
      if (!values.length) return 0;
      const sorted = [...values].sort((a, b) => a - b);
      const midpoint = Math.floor(sorted.length / 2);
      return sorted.length % 2
        ? sorted[midpoint]
        : (sorted[midpoint - 1] + sorted[midpoint]) / 2;
    };

    const stateClasses = new Set([
      'active',
      'disabled',
      'exp',
      'expanded',
      'fresh',
      'hidden',
      'in',
      'live',
      'lit',
      'on',
      'open',
      'read',
      'selected',
      'sel',
      'unread',
    ]);
    const stableClasses = (element) => [...element.classList]
      .filter((token) => (
        token
        && !stateClasses.has(token)
        && !/^progress-\d+$/.test(token)
      ))
      .sort();
    const identity = (element) => {
      const classes = stableClasses(element);
      // The production capture surface is a semantic <form>; canonical V5 used
      // a <div>. They are the same visible capSheet component, and form
      // semantics are required for native submit/accessibility behavior.
      if (activeSurfaceKey === 'quick_capture' && classes[0] === 'capSheet') {
        return 'surface.capSheet';
      }
      return `${element.tagName.toLowerCase()}${classes[0] ? `.${classes[0]}` : ''}`;
    };

    const openSurface = document.querySelector(activeSelector);
    if (!openSurface || !visible(openSurface)) {
      throw new Error(`Visible active surface not found for selector: ${activeSelector}`);
    }
    const box = rect(openSurface);
    // B1-504B makes the Quick Capture microphone capability-gated and explicitly
    // forbids any microphone affordance when the capability is false. Canonical
    // V5 predates that rule and contains an unflagged `.micBar`. Exclude only that
    // superseded subtree from flag-off structural evidence; all thresholds and
    // every remaining V5 element stay unchanged.
    const supersededFlagOffElement = (element) => (
      !isProduction
      && activeSurfaceKey === 'quick_capture'
      && Boolean(element.closest?.('.micBar'))
    );
    const surfaceElements = [openSurface, ...openSurface.querySelectorAll('*')]
      .filter((element) => visible(element) && !supersededFlagOffElement(element));
    const controls = surfaceElements.filter((element) => element.matches(
      'button, input, select, textarea, a[href], [role="button"], [tabindex]:not([tabindex="-1"])',
    ));
    const headings = surfaceElements.filter((element) => element.matches(
      'h1, h2, h3, h4, .h1, .h2, .greet, .tTitle, .pTtl',
    ));

    const componentClasses = new Set();
    const topology = new Set();
    const visualStyles = new Set();
    for (const element of surfaceElements) {
      for (const token of stableClasses(element)) componentClasses.add(token);
      if (element !== openSurface && element.parentElement) {
        topology.add(`${identity(element.parentElement)}>${identity(element)}`);
      }
      const style = getComputedStyle(element);
      const color = style.color.replace(/\s+/g, '');
      const background = style.backgroundColor.replace(/\s+/g, '');
      const fontSize = Math.round((Number.parseFloat(style.fontSize) || 0) / 2) * 2;
      const fontWeight = Math.round((Number.parseInt(style.fontWeight, 10) || 400) / 100) * 100;
      const radius = Math.round((Number.parseFloat(style.borderRadius) || 0) / 4) * 4;
      visualStyles.add([
        firstFont(style.fontFamily),
        fontSize,
        fontWeight,
        color,
        background,
        radius,
        style.display,
      ].join('|'));
    }

    const normalizedText = (element) => String(element.innerText || element.textContent || '')
      .replace(/\s+/g, ' ')
      .trim();
    const bodyElements = [...document.body.querySelectorAll('*')].filter(visible);
    const supersededMarkers = new Set(flagOffSupersededMarkers || []);
    const markerMetrics = markers
      .filter((marker) => !supersededMarkers.has(marker))
      .map((marker) => {
      const needle = marker.toLocaleLowerCase('en-US');
      const matches = bodyElements
        .map((element) => ({ element, text: normalizedText(element) }))
        .filter(({ text }) => text.toLocaleLowerCase('en-US').includes(needle))
        .sort((left, right) => (
          left.text.length - right.text.length
          || (left.element.childElementCount - right.element.childElementCount)
        ));
      const match = matches[0]?.element;
      if (!match) return { marker, found: false };
      const markerBox = rect(match);
      return {
        marker,
        found: true,
        tag: match.tagName.toLowerCase(),
        role: match.getAttribute('role') || '',
        box: markerBox,
        normalizedBox: {
          x: markerBox.x / innerWidth,
          y: markerBox.y / innerHeight,
          width: markerBox.width / innerWidth,
          height: markerBox.height / innerHeight,
        },
        style: styleSnapshot(match),
      };
      });

    const rail = document.querySelector('#rail');
    const railBox = visible(rail) ? rect(rail) : null;
    const railMode = !railBox
      ? 'absent'
      : railBox.width >= innerWidth * 0.7 && railBox.y >= innerHeight * 0.55
        ? 'bottom'
        : 'side';
    const header = document.querySelector('#hdr, header');
    const main = document.querySelector('#main');
    const rootStyle = getComputedStyle(document.documentElement);
    const tokenNames = ['--bg', '--card', '--edge', '--tx', '--accent', '--accent2'];
    const tokens = Object.fromEntries(
      tokenNames.map((name) => [name, rootStyle.getPropertyValue(name).trim().toLowerCase()]),
    );
    const documentWidth = Math.max(
      document.documentElement.scrollWidth,
      document.body.scrollWidth,
    );

    return {
      title: document.title,
      url: location.href,
      viewport: { width: innerWidth, height: innerHeight },
      document: {
        width: documentWidth,
        height: Math.max(
          document.documentElement.scrollHeight,
          document.body.scrollHeight,
        ),
        overflowX: Math.max(0, documentWidth - innerWidth),
      },
      shell: {
        railMode,
        rail: railBox,
        header: visible(header) ? rect(header) : null,
        main: visible(main) ? rect(main) : null,
      },
      activeElement: document.activeElement?.outerHTML?.slice(0, 500) || '',
      openSurface: openSurface ? {
        id: openSurface.id,
        className: openSurface.className,
        dataView: openSurface.getAttribute('data-view'),
        selector: activeSelector,
        box,
        normalizedBox: {
          x: box.x / innerWidth,
          y: box.y / innerHeight,
          width: box.width / innerWidth,
          height: box.height / innerHeight,
        },
        overflow: {
          left: Math.max(0, -box.x),
          right: Math.max(0, box.right - innerWidth),
          scrollX: Math.max(0, openSurface.scrollWidth - openSurface.clientWidth),
        },
        style: styleSnapshot(openSurface),
      } : null,
      structure: {
        visibleElements: surfaceElements.length,
        controls: controls.length,
        headings: headings.length,
        cardLike: surfaceElements.filter((element) => element.matches(
          '.panel, .sCard, .sRow, .railCard, .famCard, .bgCard, .qCard, .mStuRow, .bigAction, .qaRow',
        )).length,
        medianControlWidth: median(controls.map((element) => element.getBoundingClientRect().width)),
        medianControlHeight: median(controls.map((element) => element.getBoundingClientRect().height)),
        medianHeadingSize: median(
          headings.map((element) => Number.parseFloat(getComputedStyle(element).fontSize) || 0),
        ),
        componentClasses: [...componentClasses].sort(),
        topology: [...topology].sort(),
        visualStyles: [...visualStyles].sort(),
      },
      markers: markerMetrics,
      tokens,
      text: document.body.innerText.replace(/\s+/g, ' ').trim(),
    };
  }, {
    markers: contract.markers,
    selector,
    activeSurfaceKey: surfaceKey,
    isProduction: production,
    flagOffSupersededMarkers: contract.flagOffSupersededMarkers || [],
  });
}

async function screenshotProfile(page, png) {
  return page.evaluate(async (encoded) => {
    const bytes = Uint8Array.from(atob(encoded), (character) => character.charCodeAt(0));
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    const sourceWidth = bitmap.width;
    const sourceHeight = bitmap.height;
    const width = 64;
    const height = 48;
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0, width, height);
    bitmap.close();
    const pixels = context.getImageData(0, 0, width, height).data;
    const rgbHistogram = new Array(64).fill(0);
    const tileSums = new Array(24).fill(0);
    const tileCounts = new Array(24).fill(0);
    const luminances = new Array(width * height).fill(0);
    let meanLuminance = 0;
    let meanSaturation = 0;
    let darkPixels = 0;

    for (let index = 0; index < width * height; index += 1) {
      const offset = index * 4;
      const red = pixels[offset] / 255;
      const green = pixels[offset + 1] / 255;
      const blue = pixels[offset + 2] / 255;
      const maximum = Math.max(red, green, blue);
      const minimum = Math.min(red, green, blue);
      const saturation = maximum === 0 ? 0 : (maximum - minimum) / maximum;
      const luminance = (0.2126 * red) + (0.7152 * green) + (0.0722 * blue);
      const x = index % width;
      const y = Math.floor(index / width);
      const tileX = Math.min(5, Math.floor(x / (width / 6)));
      const tileY = Math.min(3, Math.floor(y / (height / 4)));
      const tile = (tileY * 6) + tileX;
      const histogramIndex = (
        Math.min(3, Math.floor(red * 4)) * 16
        + Math.min(3, Math.floor(green * 4)) * 4
        + Math.min(3, Math.floor(blue * 4))
      );

      rgbHistogram[histogramIndex] += 1;
      tileSums[tile] += luminance;
      tileCounts[tile] += 1;
      luminances[index] = luminance;
      meanLuminance += luminance;
      meanSaturation += saturation;
      if (luminance < 0.25) darkPixels += 1;
    }

    let edgeEnergy = 0;
    let edgeSamples = 0;
    for (let y = 0; y < height; y += 1) {
      for (let x = 0; x < width; x += 1) {
        const index = (y * width) + x;
        if (x + 1 < width) {
          edgeEnergy += Math.abs(luminances[index] - luminances[index + 1]);
          edgeSamples += 1;
        }
        if (y + 1 < height) {
          edgeEnergy += Math.abs(luminances[index] - luminances[index + width]);
          edgeSamples += 1;
        }
      }
    }

    const sampleCount = width * height;
    return {
      width: sourceWidth,
      height: sourceHeight,
      sampleGrid: { width, height },
      meanLuminance: meanLuminance / sampleCount,
      meanSaturation: meanSaturation / sampleCount,
      darkPixelRatio: darkPixels / sampleCount,
      edgeEnergy: edgeSamples ? edgeEnergy / edgeSamples : 0,
      rgbHistogram: rgbHistogram.map((count) => count / sampleCount),
      tileLuminance: tileSums.map((sum, index) => (
        tileCounts[index] ? sum / tileCounts[index] : 0
      )),
    };
  }, png.toString('base64'));
}

function jaccard(left, right) {
  const leftSet = new Set(left);
  const rightSet = new Set(right);
  const union = new Set([...leftSet, ...rightSet]);
  if (!union.size) return 1;
  let intersection = 0;
  for (const value of leftSet) {
    if (rightSet.has(value)) intersection += 1;
  }
  return intersection / union.size;
}

function meanAbsoluteDelta(left, right) {
  if (!left.length || left.length !== right.length) return Number.POSITIVE_INFINITY;
  return left.reduce((total, value, index) => (
    total + Math.abs(value - right[index])
  ), 0) / left.length;
}

function histogramDistance(left, right) {
  if (!left.length || left.length !== right.length) return Number.POSITIVE_INFINITY;
  return left.reduce((total, value, index) => (
    total + Math.abs(value - right[index])
  ), 0) / 2;
}

function parseColor(value) {
  const text = String(value || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(text)) {
    return [
      Number.parseInt(text.slice(1, 3), 16),
      Number.parseInt(text.slice(3, 5), 16),
      Number.parseInt(text.slice(5, 7), 16),
    ];
  }
  const match = text.match(/rgba?\(([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)/);
  return match ? match.slice(1, 4).map(Number) : null;
}

function colorDistance(left, right) {
  const a = parseColor(left);
  const b = parseColor(right);
  if (!a || !b) return left === right ? 0 : 255;
  return Math.sqrt(
    ((a[0] - b[0]) ** 2)
    + ((a[1] - b[1]) ** 2)
    + ((a[2] - b[2]) ** 2),
  );
}

function markerComparison(canonicalMarkers, candidateMarkers) {
  const candidateByMarker = new Map(
    candidateMarkers.map((item) => [item.marker, item]),
  );
  const details = canonicalMarkers.map((canonical) => {
    const candidate = candidateByMarker.get(canonical.marker);
    if (!canonical.found || !candidate?.found) {
      return {
        marker: canonical.marker,
        foundInBoth: false,
        visualSimilarity: 0,
      };
    }
    const fontSizeDelta = Math.abs(canonical.style.fontSize - candidate.style.fontSize);
    const fontWeightDelta = Math.abs(canonical.style.fontWeight - candidate.style.fontWeight);
    const colorDelta = colorDistance(canonical.style.color, candidate.style.color);
    const normalizedLeftDelta = Math.abs(
      canonical.normalizedBox.x - candidate.normalizedBox.x,
    );
    const normalizedWidthDelta = Math.abs(
      canonical.normalizedBox.width - candidate.normalizedBox.width,
    );
    const visualSimilarity = (
      (canonical.style.fontFamily === candidate.style.fontFamily ? 0.25 : 0)
      + (fontSizeDelta <= 3 ? 0.25 : 0)
      + (fontWeightDelta <= 200 ? 0.15 : 0)
      + (colorDelta <= 80 ? 0.15 : 0)
      + (normalizedLeftDelta <= 0.2 ? 0.1 : 0)
      + (normalizedWidthDelta <= 0.35 ? 0.1 : 0)
    );
    return {
      marker: canonical.marker,
      foundInBoth: true,
      fontSizeDelta,
      fontWeightDelta,
      colorDelta,
      normalizedLeftDelta,
      normalizedWidthDelta,
      visualSimilarity,
    };
  });
  const found = details.filter((item) => item.foundInBoth);
  return {
    coverage: canonicalMarkers.length ? found.length / canonicalMarkers.length : 1,
    meanVisualSimilarity: found.length
      ? found.reduce((total, item) => total + item.visualSimilarity, 0) / found.length
      : 0,
    details,
  };
}

function compareEvidence(
  surfaceKey,
  canonical,
  candidate,
  canonicalProfile,
  candidateProfile,
) {
  const markers = markerComparison(canonical.markers, candidate.markers);
  const componentClassJaccard = jaccard(
    canonical.structure.componentClasses,
    candidate.structure.componentClasses,
  );
  const topologyJaccard = jaccard(
    canonical.structure.topology,
    candidate.structure.topology,
  );
  const visualStyleJaccard = jaccard(
    canonical.structure.visualStyles,
    candidate.structure.visualStyles,
  );
  const topologyMinimum = (
    TOPOLOGY_MINIMUMS[surfaceKey]
    ?? VISUAL_COMPARISON_THRESHOLDS.defaultMinTopologyJaccard
  );
  const nonMarkerStructuralComposite = (
    (componentClassJaccard * STRUCTURE_WEIGHTS.componentClasses)
    + (topologyJaccard * STRUCTURE_WEIGHTS.topology)
    + (visualStyleJaccard * STRUCTURE_WEIGHTS.visualStyles)
  );
  return {
    expectedResponsiveMode: canonical.viewport.width <= 860 ? 'bottom' : 'side',
    surface: {
      normalizedLeftDelta: Math.abs(
        canonical.openSurface.normalizedBox.x - candidate.openSurface.normalizedBox.x,
      ),
      normalizedTopDelta: Math.abs(
        canonical.openSurface.normalizedBox.y - candidate.openSurface.normalizedBox.y,
      ),
      normalizedWidthDelta: Math.abs(
        canonical.openSurface.normalizedBox.width - candidate.openSurface.normalizedBox.width,
      ),
    },
    structure: {
      componentClassJaccard,
      topologyJaccard,
      visualStyleJaccard,
      topologyMinimum,
      weights: STRUCTURE_WEIGHTS,
      nonMarkerStructuralComposite,
    },
    markers,
    screenshot: {
      rgbHistogramDistance: histogramDistance(
        canonicalProfile.rgbHistogram,
        candidateProfile.rgbHistogram,
      ),
      tileLuminanceDistance: meanAbsoluteDelta(
        canonicalProfile.tileLuminance,
        candidateProfile.tileLuminance,
      ),
      meanLuminanceDelta: Math.abs(
        canonicalProfile.meanLuminance - candidateProfile.meanLuminance,
      ),
      darkPixelRatioDelta: Math.abs(
        canonicalProfile.darkPixelRatio - candidateProfile.darkPixelRatio,
      ),
      meanSaturationDelta: Math.abs(
        canonicalProfile.meanSaturation - candidateProfile.meanSaturation,
      ),
      edgeEnergyDelta: Math.abs(
        canonicalProfile.edgeEnergy - candidateProfile.edgeEnergy,
      ),
    },
  };
}

function assertComparison(label, viewport, canonical, candidate, comparison, minimums = {}) {
  const threshold = { ...VISUAL_COMPARISON_THRESHOLDS, ...minimums };
  expect(canonical.viewport, `${label} canonical viewport`).toEqual(viewport);
  expect(candidate.viewport, `${label} candidate viewport`).toEqual(viewport);
  expect(
    canonical.document.overflowX,
    `${label} canonical document horizontal overflow`,
  ).toBeLessThanOrEqual(threshold.maxDocumentOverflowPx);
  expect(
    candidate.document.overflowX,
    `${label} candidate document horizontal overflow`,
  ).toBeLessThanOrEqual(threshold.maxDocumentOverflowPx);
  expect(
    canonical.openSurface.overflow.left + canonical.openSurface.overflow.right,
    `${label} canonical active-surface edge overflow`,
  ).toBeLessThanOrEqual(threshold.maxSurfaceEdgeOverflowPx);
  expect(
    candidate.openSurface.overflow.left + candidate.openSurface.overflow.right,
    `${label} candidate active-surface edge overflow`,
  ).toBeLessThanOrEqual(threshold.maxSurfaceEdgeOverflowPx);
  expect(canonical.shell.railMode, `${label} canonical responsive rail mode`)
    .toBe(comparison.expectedResponsiveMode);
  expect(candidate.shell.railMode, `${label} candidate responsive rail mode`)
    .toBe(comparison.expectedResponsiveMode);
  expect(
    comparison.surface.normalizedLeftDelta,
    `${label} canonical-derived surface left geometry`,
  ).toBeLessThanOrEqual(threshold.maxNormalizedSurfaceLeftDelta);
  expect(
    comparison.surface.normalizedTopDelta,
    `${label} canonical-derived surface top geometry`,
  ).toBeLessThanOrEqual(threshold.maxNormalizedSurfaceTopDelta);
  expect(
    comparison.surface.normalizedWidthDelta,
    `${label} canonical-derived surface width geometry`,
  ).toBeLessThanOrEqual(threshold.maxNormalizedSurfaceWidthDelta);
  expect(
    comparison.structure.componentClassJaccard,
    `${label} active-surface component vocabulary`,
  ).toBeGreaterThanOrEqual(threshold.minComponentClassJaccard);
  expect(
    comparison.structure.topologyJaccard,
    `${label} active-surface DOM topology`,
  ).toBeGreaterThanOrEqual(comparison.structure.topologyMinimum);
  expect(
    comparison.structure.visualStyleJaccard,
    `${label} active-surface computed-style vocabulary`,
  ).toBeGreaterThanOrEqual(threshold.minVisualStyleJaccard);
  expect(
    comparison.structure.nonMarkerStructuralComposite,
    `${label} non-marker structural composite`,
  ).toBeGreaterThanOrEqual(threshold.minNonMarkerStructuralComposite);
  expect(
    comparison.markers.coverage,
    `${label} canonical marker geometry coverage`,
  ).toBeGreaterThanOrEqual(threshold.minMarkerGeometryCoverage);
  expect(
    comparison.markers.meanVisualSimilarity,
    `${label} canonical marker visual similarity`,
  ).toBeGreaterThanOrEqual(threshold.minMarkerVisualSimilarity);
  expect(candidate.tokens, `${label} canonical design tokens`).toEqual(canonical.tokens);
  expect(
    comparison.screenshot.rgbHistogramDistance,
    `${label} screenshot palette distribution`,
  ).toBeLessThanOrEqual(threshold.maxRgbHistogramDistance);
  expect(
    comparison.screenshot.tileLuminanceDistance,
    `${label} screenshot regional luminance`,
  ).toBeLessThanOrEqual(threshold.maxTileLuminanceDistance);
  expect(
    comparison.screenshot.meanLuminanceDelta,
    `${label} screenshot mean luminance`,
  ).toBeLessThanOrEqual(threshold.maxMeanLuminanceDelta);
  expect(
    comparison.screenshot.darkPixelRatioDelta,
    `${label} screenshot dark-theme coverage`,
  ).toBeLessThanOrEqual(threshold.maxDarkPixelRatioDelta);
  expect(
    comparison.screenshot.meanSaturationDelta,
    `${label} screenshot saturation`,
  ).toBeLessThanOrEqual(threshold.maxMeanSaturationDelta);
  expect(
    comparison.screenshot.edgeEnergyDelta,
    `${label} screenshot visual density`,
  ).toBeLessThanOrEqual(threshold.maxEdgeEnergyDelta);
}

export async function compareSurfacePair(
  testInfo,
  surfaceKey,
  viewportKey,
  canonicalPage,
  candidatePage,
) {
  const viewport = candidatePage.viewportSize();
  const label = `${PRODUCT_SURFACES[surfaceKey].label} at ${viewportKey}`;
  const [canonicalPng, candidatePng, canonicalMeta, candidateMeta] = await Promise.all([
    canonicalPage.screenshot({ animations: 'disabled', caret: 'hide' }),
    candidatePage.screenshot({ animations: 'disabled', caret: 'hide' }),
    pageEvidence(canonicalPage, surfaceKey, false),
    pageEvidence(candidatePage, surfaceKey, true),
  ]);
  const [canonicalProfile, candidateProfile] = await Promise.all([
    screenshotProfile(candidatePage, canonicalPng),
    screenshotProfile(candidatePage, candidatePng),
  ]);
  const comparison = compareEvidence(
    surfaceKey,
    canonicalMeta,
    candidateMeta,
    canonicalProfile,
    candidateProfile,
  );
  if (
    process.env.STORYFORGE_CONFORMANCE_DIAGNOSTICS === '1'
    && surfaceKey === 'quick_capture'
  ) {
    process.stderr.write(`${JSON.stringify({
      surfaceKey,
      viewportKey,
      topologyJaccard: comparison.structure.topologyJaccard,
      markers: comparison.markers,
      canonicalTopology: canonicalMeta.structure.topology,
      candidateTopology: candidateMeta.structure.topology,
    }, null, 2)}\n`);
  }
  const evidence = {
    method: [
      'Direct canonical-vs-candidate viewport screenshots.',
      'Canonical-derived responsive geometry and horizontal-overflow checks.',
      'Active-surface component-class, DOM-topology, and computed-style Jaccard similarity.',
      'Marker-level typography, color, and normalized horizontal-geometry similarity.',
      'Screenshot palette histogram, regional luminance, theme coverage, saturation, and edge-density comparison.',
      'This is a tolerant product-conformance gate, not a claim of pixel identity.',
    ],
    authoritySha256: CANONICAL_SHA256,
    surface: surfaceKey,
    viewport: { key: viewportKey, ...viewport },
    thresholds: {
      ...VISUAL_COMPARISON_THRESHOLDS,
      ...(PRODUCT_SURFACES[surfaceKey].conformanceMinimums || {}),
    },
    comparison,
    canonical: {
      page: canonicalMeta,
      screenshotProfile: canonicalProfile,
    },
    candidate: {
      page: candidateMeta,
      screenshotProfile: candidateProfile,
    },
  };

  await testInfo.attach(`${surfaceKey}-${viewportKey}-canonical.png`, {
    body: canonicalPng,
    contentType: 'image/png',
  });
  await testInfo.attach(`${surfaceKey}-${viewportKey}-candidate.png`, {
    body: candidatePng,
    contentType: 'image/png',
  });
  await testInfo.attach(`${surfaceKey}-${viewportKey}-comparison.json`, {
    body: Buffer.from(JSON.stringify(evidence, null, 2)),
    contentType: 'application/json',
  });

  assertComparison(
    label,
    viewport,
    canonicalMeta,
    candidateMeta,
    comparison,
    PRODUCT_SURFACES[surfaceKey].conformanceMinimums,
  );
  return evidence;
}
