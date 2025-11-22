import type { MediaAssetMeta } from "../types";

const proxyBase =
  (typeof process !== "undefined" && process.env.NEXT_PUBLIC_R2_PROXY_BASE) || "";

const normalizeProxyBase = () => {
  if (!proxyBase) return "";
  let base = proxyBase.trim();
  if (!/^https?:\/\//i.test(base)) {
    base = `https://${base}`;
  }
  return base.endsWith("/") ? base.slice(0, -1) : base;
};

export const buildAssetUrl = (r2Key?: string | null, fallback?: string) => {
  const base = normalizeProxyBase();
  if (r2Key && base) {
    return `${base}/asset/${encodeURIComponent(r2Key)}`;
  }
  return fallback ?? "";
};

export const ingestEndpoint = () => {
  const base = normalizeProxyBase();
  if (!base) return "";
  return `${base}/ingest`;
};

type AssetUrlResolution = {
  original: string;
  proxy?: string;
};

export const resolveAssetUrls = (asset: MediaAssetMeta): AssetUrlResolution => {
  const original = buildAssetUrl(asset.r2Key, asset.sourceUrl ?? asset.url ?? "");
  const proxy = asset.proxyUrl
    ? buildAssetUrl((asset as any).proxyR2Key, asset.proxyUrl)
    : undefined;
  return {
    original,
    proxy,
  };
};

export const playbackUrlForAsset = (asset: MediaAssetMeta) => {
  const { proxy, original } = resolveAssetUrls(asset);
  return proxy || original;
};

export const exportUrlForAsset = (asset: MediaAssetMeta) => {
  const { original, proxy } = resolveAssetUrls(asset);
  return original || proxy || "";
};
