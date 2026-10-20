// One bounded native page per existing worker tick. Persistent native cursor
// eventually revisits held cases without allowing one outage to starve others.
export async function reconcileCoachingUsagePage({ repository, access, limit = 25, beforeEach, leaseToken } = {}) {
  const pageSize = Math.max(1, Math.min(50, Number(limit) || 25));
  let page;
  try { page = await repository.rpc('mm_coaching_hybrid_reconciliation_page', { p_payload: { limit: pageSize, ...(leaseToken ? { token: leaseToken } : {}) } }); }
  catch { return { status: 'held', reason: 'coaching_reconciliation_page_unavailable', processed: 0 }; }
  if (page?.enabled === false) return { status: 'disabled', processed: 0 };
  if (!Array.isArray(page?.appointment_ids) || page.appointment_ids.length > pageSize || !Number.isSafeInteger(page.version)) {
    return { status: 'held', reason: 'coaching_reconciliation_page_unverified', processed: 0 };
  }
  const results = [];
  for (const appointmentId of page.appointment_ids) {
    if (beforeEach && await beforeEach() !== true) break;
    try {
      const result = await access.reconcile(appointmentId);
      results.push({ appointment_id: appointmentId, state: result.state,
        cleanup_status: result.cleanup?.ok === true ? 'verified_absent' : result.cleanup ? 'held' : 'not_required' });
    } catch { results.push({ appointment_id: appointmentId, state: 'unverified', cleanup_status: 'held' }); }
  }
  let advanced = false;
  const partial = results.length < page.appointment_ids.length;
  if (partial && !results.length) return { status: 'held', processed: 0, checkpoint_advanced: false, cycle_complete: false, results };
  try { advanced = await repository.rpc('mm_coaching_hybrid_reconciliation_checkpoint', { p_payload: {
    limit: partial ? results.length : pageSize, version: page.version,
    next_cursor: partial ? results.at(-1).appointment_id : page.next_cursor,
    ...(leaseToken ? { token: leaseToken } : {}),
  } }); }
  catch { /* No cursor advance is claimed on uncertain persistence. */ }
  return { status: advanced === true ? 'processed' : 'held', processed: results.length,
    checkpoint_advanced: advanced === true, cycle_complete: !partial && page.cycle_complete === true, results };
}
