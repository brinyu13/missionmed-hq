import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const runtime=readFileSync(new URL('../../public/source/runtime.js',import.meta.url),'utf8'),shell=readFileSync(new URL('../../public/source/shell.js',import.meta.url),'utf8');
const code=runtime.slice(runtime.indexOf('function calendarLoadingMarkup('),runtime.indexOf('function renderPublicCalendarShell('));
const c=vm.createContext({});vm.runInContext(code,c);
test('each real loading stage has exactly one current step, no fabricated percentage, and a polite status',()=>{for(const stage of ['connecting','personal','cohort']){const html=vm.runInContext(`calendarLoadingMarkup('${stage}')`,c);assert.equal((html.match(/aria-current="step"/g)||[]).length,1);assert.match(html,/role="status" aria-live="polite"/);assert.ok(!html.includes('%'));assert.match(html,new RegExp('data-calendar-loading="'+stage+'"'));}assert.equal(vm.runInContext("calendarLoadingMarkup('done')",c),'');});
test('only pending uncached cohort uses the tracker, and personal request stage follows session establishment',()=>{assert.match(shell,/pending&&S.ui.calendarScope==='all'&&!cohortPage\?\.complete&&!error\?calendarLoadingMarkup\('cohort'\)/);const boot=runtime.slice(runtime.indexOf('async function boot(){'));assert.ok(boot.indexOf('await refreshSession()')<boot.indexOf("calendarLoadingMarkup('personal')"));assert.ok(boot.indexOf("calendarLoadingMarkup('personal')")<boot.indexOf("apiFetch('/bootstrap?view=calendar')"));});
