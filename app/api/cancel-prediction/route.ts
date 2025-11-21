import { NextRequest } from "next/server";
import Replicate from "replicate";
import { apiResponse, apiError } from "@/lib/api-response";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY!,
});

export async function POST(request: NextRequest) {
  try {
    const { predictionId } = await request.json();

    if (!predictionId) {
      return apiError("predictionId is required", 400);
    }

    // Cancel the prediction via Replicate API
    const response = await fetch(
      `https://api.replicate.com/v1/predictions/${predictionId}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.REPLICATE_API_KEY}`,
          "Content-Type": "application/json",
        },
      },
    );

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("Failed to cancel prediction:", errorData);
      return apiError(
        "Failed to cancel prediction",
        response.status,
        errorData,
      );
    }

    const data = await response.json();

    return apiResponse({
      success: true,
      status: data.status,
      predictionId,
    });
  } catch (error) {
    console.error("Error canceling prediction:", error);
    return apiError(
      "Failed to cancel prediction",
      500,
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
