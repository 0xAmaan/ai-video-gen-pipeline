import { NextResponse } from "next/server";
import { api } from "@/convex/_generated/api";
import { getConvexClient } from "@/lib/server/convex";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectId = searchParams.get("projectId");
  if (!projectId) {
    return NextResponse.json({ error: "projectId is required" }, { status: 400 });
  }

  try {
    const convex = await getConvexClient();
    const result = await convex.query(api.video.loadEditorState, { projectId: projectId as any });
    return NextResponse.json(result ?? { projectData: null, history: { past: [], future: [] } });
  } catch (error) {
    console.error("/api/editor-state GET failed", error);
    return NextResponse.json({ error: "Failed to load editor state" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { projectId, projectData, sequenceNumber } = body ?? {};
    if (!projectId || !projectData) {
      return NextResponse.json({ error: "projectId and projectData are required" }, { status: 400 });
    }
    const convex = await getConvexClient();
    await convex.mutation(api.video.saveEditorState, {
      projectId: projectId as any,
      projectData,
      sequenceNumber,
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("/api/editor-state POST failed", error);
    return NextResponse.json({ error: "Failed to save editor state" }, { status: 500 });
  }
}
