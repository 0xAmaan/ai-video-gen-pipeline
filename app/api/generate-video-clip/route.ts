import { NextResponse } from "next/server";
import Replicate from "replicate";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  try {
    const {
      imageUrl,
      prompt,
      duration = 5,
      resolution = "720p",
    } = await req.json();

    if (!imageUrl || typeof imageUrl !== "string") {
      return NextResponse.json(
        { error: "Image URL is required" },
        { status: 400 },
      );
    }

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 },
      );
    }

    console.log(`Generating video clip: ${prompt.substring(0, 50)}...`);

    // Generate video using WAN 2.5 Image-to-Video Fast
    const output = await replicate.run("wan-video/wan-2.5-i2v-fast", {
      input: {
        image: imageUrl,
        prompt: prompt + ", cinematic, smooth motion, professional",
        duration: duration,
        resolution: resolution,
        negative_prompt: "blur, distortion, jitter, artifacts, low quality",
        prompt_expansion: true, // Let model enhance prompts
      },
    });

    // Get the video URL from Replicate
    let videoUrl: string;

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
      } else {
        throw new Error(
          `Unexpected array item format: ${JSON.stringify(firstOutput)}`,
        );
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
    } else {
      console.error("Unexpected output:", output);
      throw new Error(`Unexpected output format: ${typeof output}`);
    }

    console.log("Video generated successfully:", videoUrl);

    return NextResponse.json({
      success: true,
      videoUrl: videoUrl,
    });
  } catch (error) {
    console.error("Error generating video clip:", error);
    return NextResponse.json(
      {
        error: "Failed to generate video clip",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
