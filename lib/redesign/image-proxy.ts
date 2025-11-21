const buildProxyUrl = (url?: string | null) => {
  if (!url) return "";
  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) return "";
    return `/api/proxy-image?url=${encodeURIComponent(url)}`;
  } catch {
    return "";
  }
};

export const proxiedImageUrl = (url?: string | null) => buildProxyUrl(url);
