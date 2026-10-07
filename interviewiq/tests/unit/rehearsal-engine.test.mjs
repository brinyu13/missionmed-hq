import test from 'node:test';
import assert from 'node:assert/strict';
import {diagnoseAnswer,specificChange} from '../../server/rehearsal.mjs';

// ── diagnoseAnswer unit tests ────────────────────────────────────────────────
// The four transparent wording checks: outcome, story, fact, closing.

// ── Empty / missing input ────────────────────────────────────────────────────
test('empty answer returns single empty check', () => {
  const checks = diagnoseAnswer('', {});
  assert.equal(checks.length, 1);
  assert.equal(checks[0].k, 'empty');
  assert.equal(checks[0].ok, false);
});

test('whitespace-only answer returns empty check', () => {
  const checks = diagnoseAnswer('   \t\n  ', {});
  assert.equal(checks.length, 1);
  assert.equal(checks[0].k, 'empty');
});

// ── Default four checks returned ─────────────────────────────────────────────
test('non-empty answer returns four checks in default order', () => {
  const checks = diagnoseAnswer('I am interested in this program.', {});
  assert.equal(checks.length, 4);
  assert.deepEqual(checks.map(c => c.k), ['outcome', 'story', 'fact', 'closing']);
});

// ── Outcome check ────────────────────────────────────────────────────────────
test('outcome check flags percentage claims', () => {
  const checks = diagnoseAnswer('I improved outcomes by 25% in our clinic.', {});
  const outcome = checks.find(c => c.k === 'outcome');
  assert.equal(outcome.ok, false);
  assert.ok(outcome.hits.length > 0);
});

test('outcome check flags "percent" word', () => {
  const checks = diagnoseAnswer('We saw a 50 percent improvement in our unit.', {});
  const outcome = checks.find(c => c.k === 'outcome');
  assert.equal(outcome.ok, false);
});

test('outcome check flags "doubled"', () => {
  const checks = diagnoseAnswer('Our research output doubled during my tenure there.', {});
  const outcome = checks.find(c => c.k === 'outcome');
  assert.equal(outcome.ok, false);
  assert.ok(outcome.hits.some(h => h === 'doubled'));
});

test('outcome check flags "tripled"', () => {
  const checks = diagnoseAnswer('Patient satisfaction tripled after our intervention.', {});
  const outcome = checks.find(c => c.k === 'outcome');
  assert.equal(outcome.ok, false);
});

test('outcome check flags "by half"', () => {
  const checks = diagnoseAnswer('We reduced wait times by half through our initiative.', {});
  const outcome = checks.find(c => c.k === 'outcome');
  assert.equal(outcome.ok, false);
});

test('outcome check flags "zero"', () => {
  const checks = diagnoseAnswer('We achieved zero adverse events during that rotation.', {});
  const outcome = checks.find(c => c.k === 'outcome');
  assert.equal(outcome.ok, false);
});

test('outcome check passes when no quantified results', () => {
  const checks = diagnoseAnswer('I developed strong clinical skills during my rotation at this hospital.', {});
  const outcome = checks.find(c => c.k === 'outcome');
  assert.equal(outcome.ok, true);
  assert.equal(outcome.hits.length, 0);
});

// ── Story check ──────────────────────────────────────────────────────────────
test('story check passes with no story (informational)', () => {
  const checks = diagnoseAnswer('I am interested in internal medicine.', {story: null});
  const story = checks.find(c => c.k === 'story');
  assert.equal(story.ok, true);
  assert.equal(story.informational, true);
});

test('story check fails when story provided but not referenced', () => {
  const story = {summary: 'Conducted longitudinal research on hepatocellular carcinoma outcomes'};
  const checks = diagnoseAnswer('I enjoy patient care and clinical teaching activities.', {story});
  const storyCheck = checks.find(c => c.k === 'story');
  assert.equal(storyCheck.ok, false);
  assert.equal(storyCheck.hits.length, 0);
});

test('story check passes when story terms referenced', () => {
  const story = {summary: 'Conducted longitudinal research on hepatocellular carcinoma outcomes'};
  const checks = diagnoseAnswer('My longitudinal research on hepatocellular carcinoma taught me the importance of persistence.', {story});
  const storyCheck = checks.find(c => c.k === 'story');
  assert.equal(storyCheck.ok, true);
  assert.ok(storyCheck.hits.length > 0);
});

test('story check uses summary, text, or title field', () => {
  const story = {text: 'Published a multicenter randomized trial in gastroenterology'};
  const checks = diagnoseAnswer('My multicenter randomized work shaped my clinical approach.', {story});
  const storyCheck = checks.find(c => c.k === 'story');
  assert.equal(storyCheck.ok, true);
});

test('story check ignores short words (under 5 chars)', () => {
  // Words like "the", "and", "in" should not count as story hits
  const story = {summary: 'The data from our study was significant'};
  // "significant" (11 chars) should match, but common short words should not
  const checks = diagnoseAnswer('The data from our significant clinical research was published.', {story});
  const storyCheck = checks.find(c => c.k === 'story');
  assert.equal(storyCheck.ok, true);
  // Should match on "significant" (11 chars)
  assert.ok(storyCheck.hits.includes('significant'));
});

test('story check ignores common stopwords', () => {
  // "about", "their", "there", "these", "those", "which", "would", "could", "should",
  // "program", "residency", "training" are filtered out
  const story = {summary: 'I would explore training about residency programs'};
  // Answer contains only stopwords from the story — no 5+ char non-stop match
  const checks = diagnoseAnswer('I would explore the training about this residency program.', {story});
  const storyCheck = checks.find(c => c.k === 'story');
  // "would", "training", "about", "residency" are all in the stopword list;
  // "explore" is 7 chars and NOT a stopword → it matches
  // So this verifies that non-stopwords DO match while common ones are excluded
  assert.equal(storyCheck.ok, true);
  assert.ok(storyCheck.hits.includes('explore'));
  // Verify stopwords were not included in hits
  assert.ok(!storyCheck.hits.includes('would'));
  assert.ok(!storyCheck.hits.includes('training'));
  assert.ok(!storyCheck.hits.includes('about'));
  assert.ok(!storyCheck.hits.includes('residency'));
  assert.ok(!storyCheck.hits.includes('program'));
});

// ── Fact check ───────────────────────────────────────────────────────────────
test('fact check passes with no fact (informational)', () => {
  const checks = diagnoseAnswer('I am interested in this program.', {fact: null});
  const factCheck = checks.find(c => c.k === 'fact');
  assert.equal(factCheck.ok, true);
  assert.equal(factCheck.informational, true);
});

test('fact check fails when fact provided but not referenced', () => {
  const fact = {claim: 'Board certification pass rate exceeds national average'};
  const checks = diagnoseAnswer('I enjoy clinical teaching and patient care activities.', {fact});
  const factCheck = checks.find(c => c.k === 'fact');
  assert.equal(factCheck.ok, false);
  assert.equal(factCheck.hits.length, 0);
});

test('fact check passes when fact terms referenced', () => {
  const fact = {claim: 'Board certification pass rate exceeds national average'};
  const checks = diagnoseAnswer('Your board certification pass rate exceeds the national average, which demonstrates commitment to resident education.', {fact});
  const factCheck = checks.find(c => c.k === 'fact');
  assert.equal(factCheck.ok, true);
  assert.ok(factCheck.hits.length > 0);
});

test('fact check text includes claim when failing', () => {
  const fact = {claim: 'Research funding increased significantly last year'};
  const checks = diagnoseAnswer('I like patient care.', {fact});
  const factCheck = checks.find(c => c.k === 'fact');
  assert.ok(factCheck.text.includes('Research funding increased significantly last year'));
});

// ── Closing check ────────────────────────────────────────────────────────────
test('closing check passes with forward + program mention + 5+ words', () => {
  const checks = diagnoseAnswer('I am interested. I would bring my research skills to strengthen this program going forward.', {programName: 'Internal Medicine'});
  const closing = checks.find(c => c.k === 'closing');
  assert.equal(closing.ok, true);
});

test('closing check fails without forward-looking language', () => {
  const checks = diagnoseAnswer('I enjoyed my time during the clinical rotation at the program.', {});
  const closing = checks.find(c => c.k === 'closing');
  assert.equal(closing.ok, false);
});

test('closing check fails without program mention', () => {
  const checks = diagnoseAnswer('I would bring my skills to the next chapter of my career.', {});
  const closing = checks.find(c => c.k === 'closing');
  assert.equal(closing.ok, false);
});

test('closing check fails with too-short last sentence', () => {
  const checks = diagnoseAnswer('I want to bring skills here. I look forward.', {});
  const closing = checks.find(c => c.k === 'closing');
  // "I look forward." is only 3 words — below the 5-word minimum
  assert.equal(closing.ok, false);
});

test('closing check passes with program name match', () => {
  const checks = diagnoseAnswer('I want to explore how I could contribute to Mayo Clinic Internal Medicine.', {programName: 'Mayo Clinic Internal Medicine'});
  const closing = checks.find(c => c.k === 'closing');
  assert.equal(closing.ok, true);
});

test('closing check recognizes "your" as program reference', () => {
  const checks = diagnoseAnswer('I would bring my research experience to your clinical teaching program for the benefit of residents.', {});
  const closing = checks.find(c => c.k === 'closing');
  assert.equal(closing.ok, true);
});

test('closing check recognizes "residency" as program reference', () => {
  const checks = diagnoseAnswer('I look forward to contributing my clinical expertise to this residency in many ways.', {});
  const closing = checks.find(c => c.k === 'closing');
  assert.equal(closing.ok, true);
});

// ── Goal-based reordering ────────────────────────────────────────────────────
test('closing check promoted to first when goal mentions closing', () => {
  const checks = diagnoseAnswer('I enjoyed my rotation.', {goal: 'Improve my closing statement'});
  assert.equal(checks[0].k, 'closing');
  assert.equal(checks[0].goal, true);
});

test('closing check promoted when goal mentions "end"', () => {
  const checks = diagnoseAnswer('I enjoyed my rotation.', {goal: 'End with a strong impression'});
  assert.equal(checks[0].k, 'closing');
});

test('closing check promoted when goal mentions "conclusion"', () => {
  const checks = diagnoseAnswer('I enjoyed my rotation.', {goal: 'Better conclusion technique'});
  assert.equal(checks[0].k, 'closing');
});

test('closing check NOT promoted for non-closing goals', () => {
  const checks = diagnoseAnswer('I enjoyed my rotation.', {goal: 'Connect story to program facts'});
  assert.equal(checks[0].k, 'outcome');
  // closing should stay in its normal position (last)
  assert.equal(checks[3].k, 'closing');
});

// ── Multiple checks interacting ──────────────────────────────────────────────
test('all checks can fail simultaneously', () => {
  const fact = {claim: 'Nationally recognized hepatology division'};
  const story = {summary: 'Led a multicenter clinical trial on cirrhosis management'};
  // Answer: has quantified outcome, doesn't mention story or fact, no closing
  const checks = diagnoseAnswer('We improved survival by 30% in our ICU during my rotation there.', {fact, story});
  assert.equal(checks.find(c => c.k === 'outcome').ok, false);
  assert.equal(checks.find(c => c.k === 'story').ok, false);
  assert.equal(checks.find(c => c.k === 'fact').ok, false);
  assert.equal(checks.find(c => c.k === 'closing').ok, false);
});

test('all checks can pass simultaneously', () => {
  const fact = {claim: 'Nationally recognized hepatology division'};
  const story = {summary: 'Led a multicenter clinical trial on cirrhosis management'};
  // Answer: no quantified results, mentions story terms, mentions fact terms, has closing
  const checks = diagnoseAnswer('My multicenter clinical experience in cirrhosis management aligns with your nationally recognized hepatology division. I would bring this perspective to your training program with commitment.', {fact, story});
  assert.equal(checks.find(c => c.k === 'outcome').ok, true);
  assert.equal(checks.find(c => c.k === 'story').ok, true);
  assert.equal(checks.find(c => c.k === 'fact').ok, true);
  assert.equal(checks.find(c => c.k === 'closing').ok, true);
});

// ── specificChange unit tests ────────────────────────────────────────────────

test('specificChange returns satisfied message when all checks pass', () => {
  const checks = [{k:'outcome',ok:true,hits:[]},{k:'story',ok:true,hits:['research']},{k:'fact',ok:true,hits:['hepatology']},{k:'closing',ok:true,hits:['sentence']}];
  const result = specificChange(checks, {});
  assert.ok(result.includes('satisfied'));
});

test('specificChange addresses outcome first when it fails', () => {
  const checks = [
    {k:'outcome',ok:false,hits:['25%']},
    {k:'story',ok:false,hits:[]},
    {k:'fact',ok:false,hits:[]},
    {k:'closing',ok:false,hits:[]},
  ];
  const result = specificChange(checks, {});
  assert.ok(result.includes('25%'));
  assert.ok(result.includes('Verify'));
});

test('specificChange addresses story when outcome passes', () => {
  const checks = [
    {k:'outcome',ok:true,hits:[]},
    {k:'story',ok:false,hits:[]},
    {k:'fact',ok:false,hits:[]},
    {k:'closing',ok:false,hits:[]},
  ];
  const result = specificChange(checks, {});
  assert.ok(result.includes('approved experience'));
});

test('specificChange addresses fact when outcome and story pass', () => {
  const fact = {claim: 'Board pass rate exceeds national average'};
  const checks = [
    {k:'outcome',ok:true,hits:[]},
    {k:'story',ok:true,hits:['research']},
    {k:'fact',ok:false,hits:[]},
    {k:'closing',ok:false,hits:[]},
  ];
  const result = specificChange(checks, {fact});
  assert.ok(result.includes('supported program detail'));
  assert.ok(result.includes('Board pass rate'));
});

test('specificChange addresses closing when other checks pass', () => {
  const checks = [
    {k:'outcome',ok:true,hits:[]},
    {k:'story',ok:true,hits:['research']},
    {k:'fact',ok:true,hits:['board']},
    {k:'closing',ok:false,hits:[]},
  ];
  const result = specificChange(checks, {});
  assert.ok(result.includes('carry into this program'));
});

test('specificChange skips informational checks', () => {
  const checks = [
    {k:'outcome',ok:true,hits:[]},
    {k:'story',ok:true,informational:true,hits:[]},
    {k:'fact',ok:true,informational:true,hits:[]},
    {k:'closing',ok:false,hits:[]},
  ];
  const result = specificChange(checks, {});
  assert.ok(result.includes('carry into this program'));
});

test('specificChange skips overruled checks', () => {
  const checks = [
    {k:'outcome',ok:false,hits:['50%'],overruled:true},
    {k:'story',ok:false,hits:[]},
    {k:'fact',ok:true,hits:['board']},
    {k:'closing',ok:false,hits:[]},
  ];
  const result = specificChange(checks, {});
  // Should skip outcome (overruled) and address story next
  assert.ok(result.includes('approved experience'));
});

test('specificChange prioritizes goal-flagged check', () => {
  const checks = [
    {k:'outcome',ok:true,hits:[]},
    {k:'story',ok:false,hits:[]},
    {k:'fact',ok:false,hits:[]},
    {k:'closing',ok:false,hits:[],goal:true},
  ];
  const result = specificChange(checks, {goal: 'Better closing'});
  assert.ok(result.includes('Better closing'));
  assert.ok(result.includes('confirmed goal'));
});

test('specificChange goal check mentions carry into program', () => {
  const checks = [
    {k:'closing',ok:false,hits:[],goal:true},
    {k:'outcome',ok:true,hits:[]},
    {k:'story',ok:true,hits:['research']},
    {k:'fact',ok:true,hits:['board']},
  ];
  const result = specificChange(checks, {goal: 'End strongly'});
  assert.ok(result.includes('carry into this program'));
});
