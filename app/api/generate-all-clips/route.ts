import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { scenes } = await req.json();

    if (!scenes || !Array.isArray(scenes) || scenes.length === 0) {
      return NextResponse.json(
        { error: "Scenes array is required" },
        { status: 400 },
      );
    }

    console.log(`Starting ${scenes.length} video clip predictions...`);

    // Create all predictions in parallel (don't wait for completion)
    const predictionPromises = scenes.map(async (scene: any, index: number) => {
      try {
        if (!scene.imageUrl) {
          throw new Error(`Scene ${index + 1} has no image URL`);
        }

        console.log(`Creating prediction for scene ${scene.sceneNumber}...`);

        // Round duration to nearest valid value (5 or 10)
        const validDuration = scene.duration <= 7.5 ? 5 : 10;

        // Create prediction without waiting for completion
        const prediction = await replicate.predictions.create({
          version:
            "66226b38d223f8ac7a81aa33b8519759e300c2f9818a215e32900827ad6d2db5", // WAN 2.5 i2v Fast (latest)
          input: {
            image: scene.imageUrl,
            prompt:
              scene.description + ", cinematic, smooth motion, professional",
            duration: validDuration,
            resolution: "720p",
            negative_prompt: "blur, distortion, jitter, artifacts, low quality",
            prompt_expansion: true,
          },
        });

        console.log(
          `Prediction created for scene ${scene.sceneNumber}: ${prediction.id}`,
        );

        return {
          sceneNumber: scene.sceneNumber,
          sceneId: scene.id,
          predictionId: prediction.id,
          status: "pending",
          duration: scene.duration || 5,
        };
      } catch (error) {
        console.error(
          `Error creating prediction for scene ${scene.sceneNumber}:`,
          error,
        );
        return {
          sceneNumber: scene.sceneNumber,
          sceneId: scene.id,
          predictionId: null,
          status: "failed",
          errorMessage:
            error instanceof Error ? error.message : "Unknown error",
          duration: scene.duration || 5,
        };
      }
    });

    // Wait for all predictions to be created
    const predictions = await Promise.all(predictionPromises);

    const successfulPredictions = predictions.filter((p) => p.predictionId);
    const failedPredictions = predictions.filter((p) => !p.predictionId);

    console.log(
      `Predictions created: ${successfulPredictions.length}/${predictions.length} successful`,
    );

    return NextResponse.json({
      success: failedPredictions.length === 0,
      predictions: predictions,
      summary: {
        total: predictions.length,
        successful: successfulPredictions.length,
        failed: failedPredictions.length,
      },
    });
  } catch (error) {
    console.error("Error creating video predictions:", error);
    return NextResponse.json(
      {
        error: "Failed to create video predictions",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
