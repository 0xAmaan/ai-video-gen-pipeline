import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

const workerBase =
  process.env.R2_INGEST_URL ||
  process.env.NEXT_PUBLIC_R2_PROXY_BASE ||
  "";
const workerAuth = process.env.R2_INGEST_TOKEN || process.env.AUTH_TOKEN || "";

export async function POST(req: Request) {
  try {
    const { predictionId } = await req.json();

    if (!predictionId || typeof predictionId !== "string") {
      return NextResponse.json(
        { error: "Prediction ID is required" },
        { status: 400 },
      );
    }

    // Get the current status of the prediction
    const prediction = await replicate.predictions.get(predictionId);

    console.log(`Prediction ${predictionId} status: ${prediction.status}`);

    // Handle different prediction statuses
    if (prediction.status === "succeeded") {
      // Extract video URL from output
      let videoUrl: string | null = null;
      const output = prediction.output;

      // Handle FileOutput object (has .url() method)
      if (
        output &&
        typeof output === "object" &&
        "url" in output &&
        typeof (output as any).url === "function"
      ) {
        videoUrl = (output as any).url();
      }
      // Handle array of FileOutput objects
      else if (Array.isArray(output) && output.length > 0) {
        const firstOutput = output[0];
        if (
          typeof firstOutput === "object" &&
          "url" in firstOutput &&
          typeof firstOutput.url === "function"
        ) {
          videoUrl = firstOutput.url();
        } else if (typeof firstOutput === "string") {
          videoUrl = firstOutput;
        }
      }
      // Handle plain string
      else if (typeof output === "string") {
        videoUrl = output;
      }
      // Handle object with url property (not a function)
      else if (
        output &&
        typeof output === "object" &&
        "url" in output &&
        typeof (output as any).url === "string"
      ) {
        videoUrl = (output as any).url;
      }

      const ingestResult = await maybeIngestToR2(videoUrl, predictionId);

      return NextResponse.json({
        status: "complete",
        videoUrl: ingestResult?.proxyUrl ?? videoUrl,
        proxyUrl: ingestResult?.proxyUrl ?? null,
        r2Key: ingestResult?.key ?? null,
        sourceUrl: videoUrl,
      });
    } else if (
      prediction.status === "failed" ||
      prediction.status === "canceled"
    ) {
      return NextResponse.json({
        status: "failed",
        errorMessage: prediction.error || "Prediction failed",
      });
    } else {
      // Still processing (starting, processing, etc.)
      return NextResponse.json({
        status: "processing",
        progress: prediction.logs
          ? Math.min(90, prediction.logs.length * 5)
          : 0, // Rough estimate
      });
    }
  } catch (error) {
    console.error("Error polling prediction:", error);
    return NextResponse.json(
      {
        error: "Failed to poll prediction status",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}

async function maybeIngestToR2(sourceUrl: string | null, predictionId: string) {
  if (!sourceUrl || !workerBase) return null;
  const base = workerBase.endsWith("/") ? workerBase.slice(0, -1) : workerBase;
  const endpoint = `${base}/ingest`;
  const key = `videos/${predictionId}.mp4`;

  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        ...(workerAuth ? { authorization: `Bearer ${workerAuth}` } : {}),
      },
      body: JSON.stringify({ sourceUrl, key }),
    });
    if (!response.ok) {
      const text = await response.text();
      console.warn("R2 ingest failed", response.status, text);
      return null;
    }
    return {
      key,
      proxyUrl: `${base}/asset/${encodeURIComponent(key)}`,
    };
  } catch (error) {
    console.warn("R2 ingest error", error);
    return null;
  }
}
