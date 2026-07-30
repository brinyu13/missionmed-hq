import {
  definePgAcceptanceSuite,
  sourceCase,
} from './b1-507b-support.mjs';

definePgAcceptanceSuite([
  sourceCase('T8-01', 'empty-bucket dry run completes with zero-page counters', 'reconciliation', /if \(page\.objects\.length > 0\) counters\.pagesListed \+= 1/),
  sourceCase('T8-02', 'mixed dry-run keys distinguish evaluated candidates and preserved', 'reconciliation', /for \(const object of page\.objects\)[\s\S]*counters\.keysEvaluated[\s\S]*counters\.preserved[\s\S]*counters\.candidates/),
  sourceCase('T8-03', 'multi-page dry-run shares durable page advancement', 'reconciliation', /for \(let pageIndex = 0; pageIndex < MAX_PAGES_PER_RUN; pageIndex \+= 1\)/),
  sourceCase('T8-04', 'live mode executes INTEND DELETE RESOLVE in order', 'reconciliation', /createIntent[\s\S]*processIntent/),
  sourceCase('T8-05', 'mixed live outcomes have distinct counters', 'reconciliation', /deletedConfirmed[\s\S]*objectAbsent[\s\S]*preserved/),
  sourceCase('T8-10', 'unresolved intents recover before the page loop', 'reconciliation', /await recoverUnresolved\(counters\)[\s\S]*for \(let pageIndex/),
  sourceCase('T8-11', 'exhausted recovered intent terminates as failed', 'reconciliation', /intent\.attempts[\s\S]*INTENT_MAX_ATTEMPTS[\s\S]*SET state = 'failed'/),
  sourceCase('T8-12', 'finished run stores complete counters and cursor digest', 'reconciliation', /finished_at = now\(\)[\s\S]*cursor_digest_end = \$10/),
  sourceCase('T8-13', 'aborted run stores a bounded abort reason', 'reconciliation', /abort_reason = \$10/),
  sourceCase('T8-14', 'E13 maps completed reconciliation rows into health output', 'flags', /reconciliation = rows\.map[\s\S]*pagesListed/),
]);
