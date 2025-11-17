import Replicate from "replicate";
import { getFlowTracker } from "@/lib/flow-tracker";
import { getDemoModeFromHeaders } from "@/lib/demo-mode";
import { mockPollingResponse } from "@/lib/demo-mocks";
import { apiResponse, apiError } from "@/lib/api-response";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  const flowTracker = getFlowTracker();

  try {
    const { predictionId } = await req.json();

    // Get demo mode from headers
    const demoMode = getDemoModeFromHeaders(req.headers);
    const shouldMock = demoMode === "no-cost";

    // Track API call
    flowTracker.trackAPICall("POST", "/api/poll-prediction", {
      predictionId,
      demoMode,
    });

    if (!predictionId || typeof predictionId !== "string") {
      return apiError("Prediction ID is required", 400);
    }

    // If no-cost mode and it's a mock prediction, return instant complete
    if (shouldMock && predictionId.startsWith("mock-")) {
      flowTracker.trackDecision(
        "Check demo mode",
        "no-cost",
        "Returning instant mock prediction status - zero API costs",
      );
      const mockResult = mockPollingResponse("complete");
      return apiResponse({
        status: "complete",
        videoUrl: mockResult.videoUrl,
      });
    }

    // Get the current status of the prediction
    const prediction = await replicate.predictions.get(predictionId);

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

      return apiResponse({
        status: "complete",
        videoUrl: videoUrl,
      });
    } else if (
      prediction.status === "failed" ||
      prediction.status === "canceled"
    ) {
      return apiResponse({
        status: "failed",
        errorMessage: prediction.error || "Prediction failed",
      });
    } else {
      // Still processing (starting, processing, etc.)
      return apiResponse({
        status: "processing",
        progress: prediction.logs
          ? Math.min(90, prediction.logs.length * 5)
          : 0, // Rough estimate
      });
    }
  } catch (error) {
    console.error("Error polling prediction:", error);
    return apiError(
      "Failed to poll prediction status",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
