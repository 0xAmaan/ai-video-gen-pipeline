var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// workers/r2-proxy.ts
var json = /* @__PURE__ */ __name((body, init = {}) => new Response(JSON.stringify(body), {
  ...init,
  headers: {
    "content-type": "application/json",
    ...init.headers
  }
}), "json");
var r2_proxy_default = {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") {
      return withCors(new Response(null, { status: 204 }), env);
    }
    if (url.pathname.startsWith("/asset/") && (request.method === "GET" || request.method === "HEAD")) {
      return withCors(await serveAsset(request, env, url.pathname.replace("/asset/", "")), env);
    }
    if (url.pathname === "/ingest" && request.method === "POST") {
      if (!isAuthorized(request, env)) {
        return withCors(new Response("Unauthorized", { status: 401 }), env);
      }
      return withCors(await ingestToR2(request, env), env);
    }
    return new Response("Not found", { status: 404 });
  }
};
async function serveAsset(request, env, key) {
  if (!key) {
    return json({ error: "Missing key" }, { status: 400 });
  }
  const objectKey = (() => {
    try {
      return decodeURIComponent(key);
    } catch {
      return key;
    }
  })();
  try {
    const object = await env.R2_BUCKET.get(objectKey);
    if (!object || !object.body) {
      return json({ error: "Not found" }, { status: 404 });
    }
    const responseHeaders = new Headers();
    responseHeaders.set("accept-ranges", "bytes");
    responseHeaders.set("x-proxy-version", "2025-11-22-02");
    responseHeaders.set("cache-control", "private, no-store, no-cache, must-revalidate");
    const contentType = object.httpMetadata?.contentType ?? object.customMetadata?.contentType ?? "application/octet-stream";
    responseHeaders.set("content-type", contentType);
    responseHeaders.set("content-length", object.size.toString());
    console.log("serveAsset full", { key: objectKey, size: object.size, status: 200 });
    if (request.method === "HEAD") {
      return new Response(null, { status: 200, headers: responseHeaders });
    }
    return new Response(object.body, { status: 200, headers: responseHeaders });
  } catch (error) {
    console.error("R2 proxy error", error);
    return json({ error: "Proxy failure" }, { status: 502 });
  }
}
__name(serveAsset, "serveAsset");
async function ingestToR2(request, env) {
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
  const contentType = upstream.headers.get("content-type") ?? void 0;
  await env.R2_BUCKET.put(payload.key, upstream.body, {
    httpMetadata: contentType ? { contentType } : void 0,
    customMetadata: {
      sourceUrl: payload.sourceUrl
    },
    onlyIf: { doesNotExist: true },
    // Explicit object size prevents Workers from buffering the stream.
    objectSize: parsedLength
  });
  return json({ ok: true, key: payload.key });
}
__name(ingestToR2, "ingestToR2");
async function safeJson(request) {
  try {
    return await request.json();
  } catch {
    return null;
  }
}
__name(safeJson, "safeJson");
function isAuthorized(request, env) {
  if (!env.AUTH_TOKEN) return true;
  const header = request.headers.get("authorization");
  return header === `Bearer ${env.AUTH_TOKEN}`;
}
__name(isAuthorized, "isAuthorized");
function withCors(response, env) {
  const allowed = env.ALLOWED_ORIGINS?.split(",").map((v) => v.trim()) ?? [];
  const origin = allowed.length ? allowed : ["*"];
  const headers = new Headers(response.headers);
  headers.set("access-control-allow-origin", origin.join(","));
  headers.set("access-control-allow-methods", "GET,POST,OPTIONS");
  headers.set("access-control-allow-headers", "authorization,content-type,range");
  headers.set("access-control-expose-headers", "content-range,accept-ranges");
  headers.set("cross-origin-resource-policy", "cross-origin");
  return new Response(response.body, { ...response, headers });
}
__name(withCors, "withCors");
export {
  r2_proxy_default as default
};
//# sourceMappingURL=r2-proxy.js.map
