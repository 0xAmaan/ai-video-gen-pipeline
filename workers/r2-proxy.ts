export interface Env {
  R2_BUCKET: R2Bucket;
  AUTH_TOKEN?: string;
  ALLOWED_ORIGINS?: string;
}

type RangeShape = { offset: number; length?: number };

const json = (body: unknown, init: ResponseInit = {}) =>
  new Response(JSON.stringify(body), {
    ...init,
    headers: {
      "content-type": "application/json",
      ...init.headers,
    },
  });

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // CORS preflight
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), env);
    }

    if (url.pathname.startsWith("/asset/") && request.method === "GET") {
      return withCors(await serveAsset(request, env, url.pathname.replace("/asset/", "")), env);
    }

    if (url.pathname === "/ingest" && request.method === "POST") {
      if (!isAuthorized(request, env)) {
        return withCors(new Response("Unauthorized", { status: 401 }), env);
      }
      return withCors(await ingestToR2(request, env), env);
    }

    return new Response("Not found", { status: 404 });
  },
};

async function serveAsset(request: Request, env: Env, key: string): Promise<Response> {
  if (!key) {
    return json({ error: "Missing key" }, { status: 400 });
  }

  const rangeHeader = request.headers.get("range");
  const range = rangeHeader ? parseRange(rangeHeader) : null;

  try {
    const object = await env.R2_BUCKET.get(key, range ? { range } : undefined);
    if (!object || !object.body) {
      return json({ error: "Not found" }, { status: 404 });
    }

    const responseHeaders = new Headers();
    responseHeaders.set("accept-ranges", "bytes");
    const contentType =
      object.httpMetadata?.contentType ?? object.customMetadata?.contentType ?? "application/octet-stream";
    responseHeaders.set("content-type", contentType);

    if (range && object.range) {
      const start = object.range.offset;
      const length = object.range.length ?? object.size - start;
      const end = start + length - 1;
      responseHeaders.set("content-range", `bytes ${start}-${end}/${object.size}`);
      responseHeaders.set("content-length", length.toString());
      return new Response(object.body, { status: 206, headers: responseHeaders });
    }

    responseHeaders.set("content-length", object.size.toString());
    return new Response(object.body, { status: 200, headers: responseHeaders });
  } catch (error) {
    console.error("R2 proxy error", error);
    return json({ error: "Proxy failure" }, { status: 502 });
  }
}

async function ingestToR2(request: Request, env: Env): Promise<Response> {
  const payload = await safeJson(request);
  if (!payload || typeof payload.sourceUrl !== "string" || typeof payload.key !== "string") {
    return json({ error: "Expected body: { sourceUrl, key }" }, { status: 400 });
  }

  const upstream = await fetch(payload.sourceUrl);
  if (!upstream.ok || !upstream.body) {
    return json({ error: `Upstream fetch failed (${upstream.status})` }, { status: 502 });
  }

  const contentLength = upstream.headers.get("content-length");
  const parsedLength = contentLength ? Number.parseInt(contentLength, 10) : NaN;
  if (!Number.isFinite(parsedLength) || parsedLength <= 0) {
    return json({ error: "Content-Length required for streaming ingest" }, { status: 400 });
  }

  const contentType = upstream.headers.get("content-type") ?? undefined;
  await env.R2_BUCKET.put(payload.key, upstream.body, {
    httpMetadata: contentType ? { contentType } : undefined,
    customMetadata: {
      sourceUrl: payload.sourceUrl,
    },
    onlyIf: { doesNotExist: true },
    // Explicit object size prevents Workers from buffering the stream.
    objectSize: parsedLength,
  });

  return json({ ok: true, key: payload.key });
}

function parseRange(header: string): RangeShape | null {
  // Example: bytes=0-1023 or bytes=1024-
  const match = /^bytes=(\d+)-(\d+)?$/i.exec(header.trim());
  if (!match) return null;
  const start = Number.parseInt(match[1] ?? "0", 10);
  const end = match[2] ? Number.parseInt(match[2], 10) : undefined;
  if (Number.isNaN(start)) return null;
  if (end !== undefined) {
    return { offset: start, length: Math.max(0, end - start + 1) };
  }
  return { offset: start };
}

async function safeJson(request: Request): Promise<any | null> {
  try {
    return await request.json();
  } catch {
    return null;
  }
}

function isAuthorized(request: Request, env: Env): boolean {
  if (!env.AUTH_TOKEN) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${env.AUTH_TOKEN}`;
}

function withCors(response: Response, env: Env): Response {
  const allowed = env.ALLOWED_ORIGINS?.split(",").map((v) => v.trim()) ?? [];
  const origin = allowed.length ? allowed : ["*"];

  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin.join(","));
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "authorization,content-type,range");
  headers.set("access-control-expose-headers", "content-range,accept-ranges");
  return new Response(response.body, { ...response, headers });
}
