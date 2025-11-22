import { NextRequest, NextResponse } from "next/server";

const workerBase = process.env.R2_INGEST_URL || process.env.NEXT_PUBLIC_R2_PROXY_BASE || "";
const workerAuth = process.env.R2_INGEST_TOKEN || process.env.AUTH_TOKEN || "";

function normalizeWorkerBase(value: string): string {
  if (!value) return "";
  let trimmed = value.replace(/\/ingest\/?$/, "").replace(/\/+$/, "");
  if (!/^https?:\/\//i.test(trimmed)) {
    trimmed = `https://${trimmed}`;
  }
  return trimmed;
}

/**
 * DELETE /api/delete-thumbnails?assetId=xxx
 * 
 * Deletes all thumbnails for a given asset from R2 storage
 * This should be called when a media asset is removed from the project
 */
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const assetId = searchParams.get("assetId");

    if (!assetId) {
      return NextResponse.json(
        { error: "Missing assetId parameter" },
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

    // Delete all thumbnails for this asset
    // Pattern: thumbnails/{assetId}/*.jpg
    const endpoint = `${base}/delete-prefix`;
    
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(workerAuth ? { authorization: `Bearer ${workerAuth}` } : {}),
      },
      body: JSON.stringify({ 
        prefix: `thumbnails/${assetId}/`
      }),
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("R2 thumbnail cleanup failed", response.status, text);
      return NextResponse.json(
        { error: `Cleanup failed: ${text}` },
        { status: response.status }
      );
    }

    const result = await response.json();
    
    return NextResponse.json({ 
      ok: true, 
      deleted: result.deleted || 0 
    });
  } catch (error) {
    console.error("Thumbnail cleanup error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 }
    );
  }
}
