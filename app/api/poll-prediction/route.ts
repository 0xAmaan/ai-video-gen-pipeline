import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

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

      return NextResponse.json({
        status: "complete",
        videoUrl: videoUrl,
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
