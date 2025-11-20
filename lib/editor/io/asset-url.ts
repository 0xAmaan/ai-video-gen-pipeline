const proxyBase =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_R2_PROXY_BASE) || "";

export const buildAssetUrl = (r2Key?: string | null, fallback?: string) => {
  if (r2Key && proxyBase) {
    const base = proxyBase.endsWith("/") ? proxyBase.slice(0, -1) : proxyBase;
    return `${base}/asset/${encodeURIComponent(r2Key)}`;
  }
  return fallback ?? "";
};

export const ingestEndpoint = () => {
  if (!proxyBase) return "";
  const base = proxyBase.endsWith("/") ? proxyBase.slice(0, -1) : proxyBase;
  return `${base}/ingest`;
};
