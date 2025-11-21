"use client";

interface PreviewSeedResponse {
  success: boolean;
  requested: number;
  completed: number;
  failures: Array<{ shotId: string; reason: string }>;
  alreadyComplete?: boolean;
  message?: string;
}

export async function requestPreviewSeed(
  projectId: string,
  options?: { concurrency?: number },
): Promise<PreviewSeedResponse> {
  const response = await fetch("/api/seed-shot-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      concurrency: options?.concurrency ?? 2,
      mode: "preview",
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as PreviewSeedResponse;
}
