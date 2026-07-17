import { createServer } from "node:http";

const target = new URL(process.env.CIE_FIXTURE_TARGET_URL || "http://127.0.0.1:4327");
if (!process.env.CIE_FIXTURE_ALLOW || !["127.0.0.1", "localhost"].includes(target.hostname)) {
  throw new Error("Synthetic browser proxy is restricted to an explicitly allowed loopback target");
}

const port = Number(process.env.CIE_FIXTURE_PROXY_PORT || 4328);
if (!Number.isSafeInteger(port) || port < 1024 || port > 65535) throw new Error("Synthetic browser proxy port is invalid");

const server = createServer(async (request, response) => {
  try {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const headers = new Headers();
    for (const [name, value] of Object.entries(request.headers)) {
      if (value !== undefined && !["host", "connection", "content-length"].includes(name)) headers.set(name, Array.isArray(value) ? value.join(", ") : value);
    }
    headers.set("x-cie-local-subject", "synthetic_student_browser");
    headers.set("x-cie-local-role", "student");
    headers.set("x-cie-local-session", "synthetic_local_authority_session");
    const upstream = await fetch(new URL(request.url || "/", target), {
      method: request.method,
      headers,
      body: chunks.length ? Buffer.concat(chunks) : undefined,
      redirect: "manual"
    });
    const responseHeaders = Object.fromEntries(upstream.headers.entries());
    response.writeHead(upstream.status, responseHeaders);
    response.end(Buffer.from(await upstream.arrayBuffer()));
  } catch {
    response.writeHead(502, { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" });
    response.end("Local browser acceptance proxy unavailable\n");
  }
});

server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`CIE synthetic browser proxy listening on http://127.0.0.1:${port}\n`);
});
