const MAX_ACTOR_BLOCK_BYTES = 6 * 1024;

function exactSubject(value) {
  const subject = String(value || '').trim();
  return /^wp:[1-9][0-9]{0,19}$/u.test(subject) ? subject : null;
}

function exactUuid(value) {
  const id = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/u.test(id) ? id : null;
}

function exactPackVersion(value) {
  const version = String(value || '').trim();
  return /^[0-9a-f]{64}$/u.test(version) ? version : null;
}

function boundedActorBlock(value) {
  const block = String(value || '');
  return block.startsWith('AUTHORIZED APPLICATION CONTEXT\n')
    && Buffer.byteLength(block, 'utf8') <= MAX_ACTOR_BLOCK_BYTES
    ? block
    : null;
}

export function createIvocContextPackResolver({ rest } = {}) {
  if (!rest || typeof rest.table !== 'function') {
    throw new TypeError('IVOC context-pack storage is required.');
  }
  return async function resolveIvocContextPack({ subject, sessionId } = {}) {
    const owner = exactSubject(subject);
    const session = exactUuid(sessionId);
    if (!owner || !session) throw new TypeError('IVOC context-pack identity is invalid.');
    const rows = await rest.table(
      'ivoc_context_packs',
      `?session_id=eq.${encodeURIComponent(session)}&owner_subject=eq.${encodeURIComponent(owner)}&invalidated_at=is.null&select=pack_id,pack_version,actor_block&limit=1`,
    );
    const row = Array.isArray(rows) && rows.length === 1 ? rows[0] : null;
    const packId = exactUuid(row?.pack_id);
    const packVersion = exactPackVersion(row?.pack_version);
    const actorBlock = boundedActorBlock(row?.actor_block);
    if (!packId || !packVersion || !actorBlock) return null;
    return Object.freeze({
      receipt: `ctxpack:${packId}@${packVersion}`,
      actorBlock,
    });
  };
}
