const DENIED = Object.freeze({ ok: false, code: 'ivprep_durable_provider_gate_unavailable' });

function exactLoopbackEndpoint(value) {
  try {
    const url = new URL(String(value || ''));
    if (url.protocol !== 'http:' || url.hostname !== '127.0.0.1'
      || !url.port || url.username || url.password || url.search || url.hash
      || url.pathname !== '/_3441r/worker') return null;
    return url.href.replace(/\/$/u, '');
  } catch {
    return null;
  }
}

function abortedDelay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) return reject(new Error('Durable observation aborted.'));
    const abort = () => {
      clearTimeout(timer);
      reject(new Error('Durable observation aborted.'));
    };
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', abort);
      resolve();
    }, milliseconds);
    signal?.addEventListener('abort', abort, { once: true });
  });
}

export function createProfileBDurableGate({ endpoint, token, fetchImpl = fetch } = {}) {
  const base = exactLoopbackEndpoint(endpoint);
  const secret = String(token || '');
  if (!base || !/^[A-Za-z0-9_-]{32,256}$/u.test(secret) || typeof fetchImpl !== 'function') {
    return Object.freeze({
      claimJob: async () => DENIED,
      waitForTermination: async () => DENIED,
      markWorkerJoined: async () => DENIED,
      reconcileJob: async () => DENIED,
    });
  }
  const post = async (operation, input, { signal = null } = {}) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort('control_timeout'), 2_000);
    const abort = () => controller.abort('control_aborted');
    signal?.addEventListener('abort', abort, { once: true });
    try {
      const response = await fetchImpl(`${base}/${operation}`, {
        method: 'POST',
        redirect: 'error',
        cache: 'no-store',
        headers: {
          'Content-Type': 'application/json',
          'X-IVPrep-Proof-Token': secret,
        },
        body: JSON.stringify(input),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Durable control operation denied.');
      const value = await response.json();
      if (!value || typeof value !== 'object' || value.ok !== true) throw new Error('Durable control response invalid.');
      return value;
    } finally {
      clearTimeout(timeout);
      signal?.removeEventListener('abort', abort);
    }
  };
  return Object.freeze({
    claimJob: (input) => post('claim', input),
    waitForTermination: async (input) => {
      while (!input.signal?.aborted) {
        const observed = await post('observe-termination', {
          reservationId: input.reservationId,
          reservationNonce: input.reservationNonce,
          jobId: input.jobId,
          dispatchId: input.dispatchId,
          roomName: input.roomName,
        }, { signal: input.signal });
        if (observed.requested === true) return observed;
        await abortedDelay(100, input.signal);
      }
      throw new Error('Durable observation aborted.');
    },
    markWorkerJoined: (input) => post('mark-joined', input),
    reconcileJob: (input) => post('reconcile', input),
  });
}

// Missing or malformed local proof bindings remain deny-all. A future product
// database adapter requires separate authority and does not fall through here.
export const profileBDurableGate = createProfileBDurableGate({
  endpoint: process.env.IVPREP_FOUNDER_PROOF_GATE_URL,
  token: process.env.IVPREP_FOUNDER_PROOF_GATE_TOKEN,
});

export default profileBDurableGate;
