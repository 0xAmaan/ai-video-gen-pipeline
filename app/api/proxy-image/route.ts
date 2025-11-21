"use server";

const ALLOWED_PROTOCOLS = new Set(["http:", "https:"]);

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const target = searchParams.get("url");

  if (!target) {
    return new Response("Missing url", { status: 400 });
  }

  let targetUrl: URL;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400 });
  }

  if (!ALLOWED_PROTOCOLS.has(targetUrl.protocol)) {
    return new Response("Unsupported protocol", { status: 400 });
  }

  const upstream = await fetch(targetUrl.toString());
  if (!upstream.ok || !upstream.body) {
    return new Response("Failed to fetch image", { status: 502 });
  }

  const responseHeaders = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) {
    responseHeaders.set("content-type", contentType);
  }
  responseHeaders.set("cross-origin-resource-policy", "same-origin");

  return new Response(upstream.body, {
    status: 200,
    headers: responseHeaders,
  });
}
