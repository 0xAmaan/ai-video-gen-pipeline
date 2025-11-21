import { generateObject } from "ai";
import { groq } from "@ai-sdk/groq";
import { openai } from "@ai-sdk/openai";
import { z } from "zod";
import { NextResponse } from "next/server";
import { STORYBOARD_SYSTEM_PROMPT, buildStoryboardPrompt } from "@/lib/prompts";

const sceneSchema = z.object({
  scenes: z
    .array(
      z.object({
        sceneNumber: z.number(),
        description: z.string(),
        visualPrompt: z.string(),
        duration: z.number(),
      }),
    )
    .min(3)
    .max(5),
});

// JSON Schema for OpenAI's structured output
const openaiJsonSchema = {
  type: "object",
  properties: {
    scenes: {
      type: "array",
      items: {
        type: "object",
        properties: {
          sceneNumber: { type: "number" },
          description: { type: "string" },
          visualPrompt: { type: "string" },
          duration: { type: "number" },
        },
        required: ["sceneNumber", "description", "visualPrompt", "duration"],
        additionalProperties: false,
      },
      minItems: 3,
      maxItems: 5,
    },
  },
  required: ["scenes"],
  additionalProperties: false,
};

export async function POST(req: Request) {
  try {
    const { prompt, responses } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt required" }, { status: 400 });
    }

    const userPrompt = buildStoryboardPrompt(prompt, responses);
    const results: any = {};

    // ========================================
    // Test 1: Vercel AI SDK with Groq
    // ========================================
    console.log("\n🧪 TEST 1: Vercel AI SDK with Groq");
    console.log("=".repeat(80));
    const groqStart = Date.now();

    try {
      const { object: groqData } = await generateObject({
        model: groq("llama-3.3-70b-versatile"),
        schema: sceneSchema,
        system: STORYBOARD_SYSTEM_PROMPT,
        prompt: userPrompt,
      });
      const groqEnd = Date.now();
      const groqTime = groqEnd - groqStart;

      results.vercelSdkGroq = {
        success: true,
        timeMs: groqTime,
        timeSec: (groqTime / 1000).toFixed(2),
        sceneCount: groqData.scenes.length,
        model: "llama-3.3-70b-versatile",
      };

      console.log(
        `✅ Vercel SDK (Groq): ${groqTime}ms (${(groqTime / 1000).toFixed(2)}s)`,
      );
      console.log(`   Generated ${groqData.scenes.length} scenes`);
    } catch (error) {
      results.vercelSdkGroq = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      console.error("❌ Vercel SDK (Groq) failed:", error);
    }

    // ========================================
    // Test 2: Direct OpenAI API with GPT-4o
    // ========================================
    console.log("\n🧪 TEST 2: Direct OpenAI API (gpt-4o)");
    console.log("=".repeat(80));
    const openaiDirectStart = Date.now();

    try {
      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            messages: [
              { role: "system", content: STORYBOARD_SYSTEM_PROMPT },
              { role: "user", content: userPrompt },
            ],
            response_format: {
              type: "json_schema",
              json_schema: {
                name: "storyboard_scenes",
                strict: true,
                schema: openaiJsonSchema,
              },
            },
          }),
        },
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
      }

      const data = await response.json();
      const openaiDirectEnd = Date.now();
      const openaiDirectTime = openaiDirectEnd - openaiDirectStart;

      const parsedData = JSON.parse(data.choices[0].message.content);

      results.directOpenAI = {
        success: true,
        timeMs: openaiDirectTime,
        timeSec: (openaiDirectTime / 1000).toFixed(2),
        sceneCount: parsedData.scenes.length,
        model: "gpt-4o",
        tokensUsed: {
          prompt: data.usage.prompt_tokens,
          completion: data.usage.completion_tokens,
          total: data.usage.total_tokens,
        },
      };

      console.log(
        `✅ Direct OpenAI API: ${openaiDirectTime}ms (${(openaiDirectTime / 1000).toFixed(2)}s)`,
      );
      console.log(`   Generated ${parsedData.scenes.length} scenes`);
      console.log(
        `   Tokens: ${data.usage.total_tokens} (prompt: ${data.usage.prompt_tokens}, completion: ${data.usage.completion_tokens})`,
      );
    } catch (error) {
      results.directOpenAI = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      console.error("❌ Direct OpenAI API failed:", error);
    }

    // ========================================
    // Test 3: Vercel AI SDK with OpenAI
    // ========================================
    console.log("\n🧪 TEST 3: Vercel AI SDK with OpenAI (gpt-4o)");
    console.log("=".repeat(80));
    const vercelOpenaiStart = Date.now();

    try {
      const { object: openaiData } = await generateObject({
        model: openai("gpt-4o"),
        schema: sceneSchema,
        system: STORYBOARD_SYSTEM_PROMPT,
        prompt: userPrompt,
      });
      const vercelOpenaiEnd = Date.now();
      const vercelOpenaiTime = vercelOpenaiEnd - vercelOpenaiStart;

      results.vercelSdkOpenAI = {
        success: true,
        timeMs: vercelOpenaiTime,
        timeSec: (vercelOpenaiTime / 1000).toFixed(2),
        sceneCount: openaiData.scenes.length,
        model: "gpt-4o",
      };

      console.log(
        `✅ Vercel SDK (OpenAI): ${vercelOpenaiTime}ms (${(vercelOpenaiTime / 1000).toFixed(2)}s)`,
      );
      console.log(`   Generated ${openaiData.scenes.length} scenes`);
    } catch (error) {
      results.vercelSdkOpenAI = {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      };
      console.error("❌ Vercel SDK (OpenAI) failed:", error);
    }

    // ========================================
    // Summary
    // ========================================
    console.log("\n📊 SPEED TEST SUMMARY");
    console.log("=".repeat(80));

    const times: { name: string; ms: number }[] = [];
    if (results.vercelSdkGroq?.success) {
      times.push({
        name: "Vercel SDK (Groq)",
        ms: results.vercelSdkGroq.timeMs,
      });
    }
    if (results.directOpenAI?.success) {
      times.push({
        name: "Direct OpenAI API",
        ms: results.directOpenAI.timeMs,
      });
    }
    if (results.vercelSdkOpenAI?.success) {
      times.push({
        name: "Vercel SDK (OpenAI)",
        ms: results.vercelSdkOpenAI.timeMs,
      });
    }

    times.sort((a, b) => a.ms - b.ms);

    times.forEach((t, i) => {
      const emoji = i === 0 ? "🥇" : i === 1 ? "🥈" : "🥉";
      console.log(
        `${emoji} ${t.name}: ${t.ms}ms (${(t.ms / 1000).toFixed(2)}s)`,
      );
    });

    if (times.length > 1) {
      const fastest = times[0].ms;
      const slowest = times[times.length - 1].ms;
      const speedup = (((slowest - fastest) / slowest) * 100).toFixed(1);
      console.log(`\n⚡ Fastest is ${speedup}% faster than slowest`);
    }

    console.log("=".repeat(80) + "\n");

    return NextResponse.json({
      success: true,
      results,
      summary: {
        winner: times[0]?.name,
        ranking: times.map((t) => t.name),
      },
    });
  } catch (error) {
    console.error("Test failed:", error);
    return NextResponse.json(
      {
        error: "Speed test failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    );
  }
}
