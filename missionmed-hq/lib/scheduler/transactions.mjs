export const SCHEDULER_TRANSACTION_RPC_NAMES = {
  book: 'mm_scheduler_book_appointment',
  reschedule: 'mm_scheduler_reschedule_appointment',
  cancel: 'mm_scheduler_cancel_appointment',
};

export class SchedulerTransactionNotConfiguredError extends Error {
  constructor(action, details = {}) {
    super(`Scheduler ${action} transaction is not configured.`);
    this.name = 'SchedulerTransactionNotConfiguredError';
    this.code = 'scheduler_transaction_not_configured';
    this.status = 501;
    this.details = {
      action,
      required_rpc: SCHEDULER_TRANSACTION_RPC_NAMES[action] || null,
      ...details,
    };
  }
}

export function createSchedulerTransactionAdapter({ rpcClient = null, mode = 'not_configured' } = {}) {
  return {
    mode,
    isConfigured: Boolean(rpcClient),

    async book(payload = {}) {
      return callTransactionRpc({ action: 'book', payload, rpcClient });
    },

    async reschedule(payload = {}) {
      return callTransactionRpc({ action: 'reschedule', payload, rpcClient });
    },

    async cancel(payload = {}) {
      return callTransactionRpc({ action: 'cancel', payload, rpcClient });
    },
  };
}

async function callTransactionRpc({ action, payload, rpcClient }) {
  const functionName = SCHEDULER_TRANSACTION_RPC_NAMES[action];
  if (!functionName || typeof rpcClient !== 'function') {
    throw new SchedulerTransactionNotConfiguredError(action, {
      reason: 'Supabase RPC client is unavailable. Production booking must use a server-side service-role transaction path.',
    });
  }

  return rpcClient(functionName, { p_payload: payload });
}

export function describeSchedulerTransactionContract() {
  return {
    mode: 'service_role_rpc_required',
    rpc_names: { ...SCHEDULER_TRANSACTION_RPC_NAMES },
    required_atomic_steps: [
      'reserve idempotency key',
      'validate appointment type/provider/resource/schedule event state',
      'validate enrollment/eligibility through server adapter',
      'validate blackout/provider/resource/group-capacity conflicts',
      'write appointment mutation',
      'write intake answers when present',
      'write audit event',
      'enqueue notification placeholder',
      'commit or rollback the whole operation',
    ],
    browser_direct_writes_allowed: false,
  };
}
