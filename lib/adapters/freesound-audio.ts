import {
  AUDIO_MODELS,
  getAudioModel,
  type SoundLibraryAdapter,
  type SoundLibraryResult,
  type SoundLibrarySearchRequest,
} from "@/lib/audio-models";

const API_BASE = "https://freesound.org/apiv2/search/text/";
const DEFAULT_FIELDS =
  "id,name,tags,description,duration,previews,username,license,url";

const getRequiredEnv = (key: string): string => {
  const value = process.env[key];
  if (!value) {
    throw new Error(`${key} is not configured`);
  }
  return value;
};

type FreesoundPreviewKey = "preview-hq-mp3" | "preview-lq-mp3";

type FreesoundHit = {
  id: number;
  name?: string;
  description?: string;
  tags?: string[];
  duration?: number;
  username?: string;
  license?: string;
  url?: string;
  previews?: Partial<Record<FreesoundPreviewKey, string>>;
};

type FreesoundResponse = {
  results?: FreesoundHit[];
  count?: number;
};

const sanitizeUrl = (url?: string | null) => url?.trim() ?? "";

export class FreesoundAudioAdapter implements SoundLibraryAdapter {
  providerKey: keyof typeof AUDIO_MODELS;
  vendor = "freesound" as const;
  kind = "sound_library" as const;

  private readonly apiKey: string;

  constructor(providerKey: keyof typeof AUDIO_MODELS = "freesound-library") {
    const config = getAudioModel(providerKey);
    if (config.vendor !== "freesound" || config.kind !== "sound_library") {
      throw new Error(
        `FreesoundAudioAdapter requires a Freesound sound library model, received ${config.name}`,
      );
    }
    this.providerKey = providerKey;
    this.apiKey = getRequiredEnv("FREESOUND_API_KEY");
  }

  private buildParams(request: SoundLibrarySearchRequest): URLSearchParams {
    const searchTerms = [request.query ?? ""];
    if (request.mood) {
      searchTerms.push(request.mood);
    }
    if (request.category) {
      searchTerms.push(request.category);
    }

    const params = new URLSearchParams({
      query: searchTerms.filter(Boolean).join(" ").trim() || "*",
      fields: DEFAULT_FIELDS,
      page: String(request.page ?? 1),
      page_size: String(request.perPage ?? 20),
      sort: "score",
    });

    if (request.durationRange) {
      const [min, max] = request.durationRange;
      const minSafe = Math.max(0, Math.floor(min));
      const maxSafe = Math.max(minSafe, Math.ceil(max));
      params.set("filter", `duration:[${minSafe} TO ${maxSafe}]`);
    }

    return params;
  }

  private mapHit(hit: FreesoundHit): SoundLibraryResult {
    const tags = Array.isArray(hit.tags)
      ? hit.tags.map((tag) => (typeof tag === "string" ? tag : "")).filter(Boolean)
      : [];
    const durationSeconds =
      typeof hit.duration === "number" ? hit.duration : 0;
    const hqPreview = sanitizeUrl(hit.previews?.["preview-hq-mp3"]);
    const lqPreview = sanitizeUrl(hit.previews?.["preview-lq-mp3"]);
    const fallbackUrl = hqPreview || lqPreview;

    const result: SoundLibraryResult = {
      id: String(hit.id),
      title: hit.name || tags[0] || `Freesound Track ${hit.id}`,
      url: fallbackUrl,
      streamUrl: hqPreview || undefined,
      downloadUrl: lqPreview || hqPreview || undefined,
      durationSeconds,
      tags,
      previewUrl: fallbackUrl || undefined,
      attribution: hit.username,
    };

    return result;
  }

  async searchLibrary(
    request: SoundLibrarySearchRequest,
  ): Promise<SoundLibraryResult[]> {
    const params = this.buildParams(request);
    const requestUrl = `${API_BASE}?${params.toString()}`;
    console.log("[FreesoundAudioAdapter] Executing search", {
      providerKey: this.providerKey,
      request,
      url: requestUrl,
    });
    try {
      const response = await fetch(requestUrl, {
        headers: {
          Authorization: `Token ${this.apiKey}`,
        },
      });
      console.log("[FreesoundAudioAdapter] HTTP response", {
        status: response.status,
        ok: response.ok,
      });
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Freesound audio search failed (${response.status}): ${errorText}`,
        );
      }

      const data = (await response.json()) as FreesoundResponse;
      console.log("[FreesoundAudioAdapter] Raw API response", data);

      if (!Array.isArray(data.results)) {
        console.warn("[FreesoundAudioAdapter] Response missing results array");
        return [];
      }

      const results = data.results.map((hit) => this.mapHit(hit));
      console.log("[FreesoundAudioAdapter] Returning results", {
        count: results.length,
        ids: results.slice(0, 5).map((result) => result.id),
      });
      return results;
    } catch (error) {
      console.error("[FreesoundAudioAdapter] searchLibrary failed", {
        error,
        request,
      });
      throw error;
    }
  }
}
