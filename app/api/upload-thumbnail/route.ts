import { NextRequest, NextResponse } from "next/server";

const workerBase = process.env.R2_INGEST_URL || process.env.NEXT_PUBLIC_R2_PROXY_BASE || "";
const workerAuth = process.env.R2_INGEST_TOKEN || process.env.AUTH_TOKEN || "";

function normalizeWorkerBase(value: string): string {
  if (!value) return "";
  // Remove trailing /ingest or slashes
  let trimmed = value.replace(/\/ingest\/?$/, "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * POST /api/upload-thumbnail
 * 
 * Uploads a thumbnail image to R2 storage
 * 
 * Body: FormData with:
 *   - file: Blob (JPEG image)
 *   - assetId: string
 *   - index: number
 * 
 * Returns: { url: string } - The R2 proxy URL for the thumbnail
 */
export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file") as Blob;
    const assetId = formData.get("assetId") as string;
    const index = formData.get("index") as string;

    if (!file || !assetId || index === null) {
      return NextResponse.json(
        { error: "Missing required fields: file, assetId, index" },
        { status: 400 }
      );
    }

    const base = normalizeWorkerBase(workerBase);
    if (!base) {
      return NextResponse.json(
        { error: "R2 proxy not configured" },
        { status: 500 }
      );
    }

    // R2 key pattern: thumbnails/{assetId}/{index}.jpg
    const key = `thumbnails/${assetId}/${index}.jpg`;

    // Upload directly to R2 using Cloudflare's API
    // We need to modify the worker to support direct PUT uploads
    // For now, let's use a direct R2 upload endpoint
    const endpoint = `${base}/upload-direct`;
    
    const uploadFormData = new FormData();
    uploadFormData.append("file", file);
    uploadFormData.append("key", key);
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        ...(workerAuth ? { authorization: `Bearer ${workerAuth}` } : {}),
      },
      body: uploadFormData,
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("R2 thumbnail upload failed", response.status, text);
      return NextResponse.json(
        { error: `Upload failed: ${text}` },
        { status: response.status }
      );
    }

    // Return the R2 proxy URL
    const url = `${base}/asset/${encodeURIComponent(key)}`;
    
    return NextResponse.json({ url });
  } catch (error) {
    console.error("Thumbnail upload error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 500 }
    );
  }
}
