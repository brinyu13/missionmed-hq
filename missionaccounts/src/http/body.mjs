export async function readRawBody(request, { limitBytes = 1_048_576 } = {}) {
  const contentLength = Number(request.headers['content-length']);
  if (Number.isFinite(contentLength) && contentLength > limitBytes) {
    throw Object.assign(new Error('Request body exceeds the allowed size'), { status: 413 });
  }

  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > limitBytes) throw Object.assign(new Error('Request body exceeds the allowed size'), { status: 413 });
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

export function parseJsonBody(rawBody) {
  try {
    return JSON.parse(rawBody.toString('utf8'));
  } catch {
    throw Object.assign(new Error('Request body must be valid JSON'), { status: 400 });
  }
}

export async function readJsonBody(request, options) {
  return parseJsonBody(await readRawBody(request, options));
}
