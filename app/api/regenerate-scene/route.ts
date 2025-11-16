import { NextResponse } from "next/server";
import Replicate from "replicate";
import { IMAGE_MODELS } from "@/lib/image-models";

const replicate = new Replicate({
  auth: process.env.REPLICATE_API_KEY,
});

export async function POST(req: Request) {
  try {
    const { visualPrompt, responses, style } = await req.json();

    if (!visualPrompt || typeof visualPrompt !== "string") {
      return NextResponse.json(
        { error: "Visual prompt is required" },
        { status: 400 },
      );
    }

    const modelConfig = IMAGE_MODELS["leonardo-phoenix"];

    // Select style based on responses or use provided style
    let phoenixStyle = style || "cinematic";

    if (!style && responses && responses["visual-style"]) {
      const visualStyle = responses["visual-style"].toLowerCase();
      if (
        visualStyle.includes("documentary") ||
        visualStyle.includes("black and white")
      ) {
        phoenixStyle = "pro_bw_photography";
      } else if (
        visualStyle.includes("cinematic") ||
        visualStyle.includes("film")
      ) {
        phoenixStyle = "cinematic";
      } else if (
        visualStyle.includes("photo") ||
        visualStyle.includes("realistic")
      ) {
        phoenixStyle = "pro_color_photography";
      } else if (
        visualStyle.includes("animated") ||
        visualStyle.includes("cartoon")
      ) {
        phoenixStyle = "illustration";
      } else if (
        visualStyle.includes("vintage") ||
        visualStyle.includes("retro")
      ) {
        phoenixStyle = "pro_film_photography";
      }
    }

    console.log(
      `Regenerating scene with ${modelConfig.name} (style: ${phoenixStyle})`,
    );

    const output = await replicate.run(
      modelConfig.id as `${string}/${string}`,
      {
        input: {
          prompt: visualPrompt,
          aspect_ratio: "16:9",
          generation_mode: "quality",
          contrast: "medium",
          num_images: 1,
          prompt_enhance: false,
          style: phoenixStyle,
        },
      },
    );

    // Extract image URL from output
    let imageUrl: string;
    if (Array.isArray(output) && output.length > 0) {
      imageUrl =
        typeof output[0] === "string"
          ? output[0]
          : (output[0] as any).url?.() || output[0];
    } else if (typeof output === "string") {
      imageUrl = output;
    } else {
      throw new Error(`Unexpected output format: ${typeof output}`);
    }

    console.log("Regenerated image URL:", imageUrl);

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
    });
  } catch (error) {
    console.error("Error regenerating scene:", error);
    return NextResponse.json(
      {
        error: "Failed to regenerate scene",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
