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
  const response = await fetch("/api/project-redesign/seed-shot-images", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      concurrency: options?.concurrency ?? 2,
    }),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(body || response.statusText);
  }

  return (await response.json()) as PreviewSeedResponse;
}
