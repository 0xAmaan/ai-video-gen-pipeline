import {
  AUDIO_MODELS,
  DEFAULT_MUSIC_MODEL,
  DEFAULT_VOICE_MODEL,
  type AudioModel,
  type AudioVendor,
  type MusicGenerationAdapter,
  type SoundLibraryAdapter,
  type VoiceSynthesisAdapter,
} from "@/lib/audio-models";
import { ReplicateMusicAdapter } from "@/lib/adapters/replicate-music";
import { ElevenLabsVoiceAdapter } from "@/lib/adapters/elevenlabs-voice";
import { ReplicateVoiceAdapter } from "@/lib/adapters/replicate-voice";
import { FreesoundAudioAdapter } from "@/lib/adapters/freesound-audio";

type VoiceAdapterFactoryOptions = {
  modelKey?: keyof typeof AUDIO_MODELS;
  vendor?: AudioVendor;
};

type MusicAdapterFactoryOptions = {
  modelKey?: keyof typeof AUDIO_MODELS;
  vendor?: AudioVendor;
};

type SoundLibraryAdapterFactoryOptions = {
  modelKey?: keyof typeof AUDIO_MODELS;
  vendor?: AudioVendor;
};

const findModelKey = (
  desiredKind: AudioModel["kind"],
  vendor?: AudioVendor,
  modelKey?: keyof typeof AUDIO_MODELS,
): keyof typeof AUDIO_MODELS => {
  if (modelKey) {
    const model = AUDIO_MODELS[modelKey];
    if (!model || model.kind !== desiredKind) {
      throw new Error(
        `Audio model "${modelKey}" is not of kind "${desiredKind}".`,
      );
    }
    if (vendor && model.vendor !== vendor) {
      throw new Error(
        `Audio model "${modelKey}" does not belong to vendor "${vendor}".`,
      );
    }
    return modelKey;
  }

  const fallbackEntry = Object.entries(AUDIO_MODELS).find(
    ([, model]) =>
      model.kind === desiredKind &&
      (vendor ? model.vendor === vendor : true),
  );

  if (!fallbackEntry) {
    throw new Error(
      `No audio model found for kind "${desiredKind}"${
        vendor ? ` and vendor "${vendor}"` : ""
      }.`,
    );
  }

  return fallbackEntry[0] as keyof typeof AUDIO_MODELS;
};

const defaultVoiceModelForVendor = (vendor?: AudioVendor) => {
  if (!vendor) return DEFAULT_VOICE_MODEL;
  const entry = Object.entries(AUDIO_MODELS).find(
    ([, model]) =>
      model.kind === "voice_synthesis" && model.vendor === vendor,
  );
  return (entry?.[0] ??
    DEFAULT_VOICE_MODEL) as keyof typeof AUDIO_MODELS;
};

const defaultMusicModelForVendor = (vendor?: AudioVendor) => {
  if (!vendor) return DEFAULT_MUSIC_MODEL;
  const entry = Object.entries(AUDIO_MODELS).find(
    ([, model]) =>
      model.kind === "music_generation" && model.vendor === vendor,
  );
  return (entry?.[0] ??
    DEFAULT_MUSIC_MODEL) as keyof typeof AUDIO_MODELS;
};

export function getVoiceAdapter(
  options: VoiceAdapterFactoryOptions = {},
): VoiceSynthesisAdapter {
  const targetModelKey = options.modelKey
    ? options.modelKey
    : defaultVoiceModelForVendor(options.vendor);

  const finalModelKey = findModelKey(
    "voice_synthesis",
    options.vendor,
    targetModelKey,
  );
  const config = AUDIO_MODELS[finalModelKey];

  switch (config.vendor) {
    case "replicate":
      return new ReplicateVoiceAdapter(finalModelKey);
    case "elevenlabs":
      return new ElevenLabsVoiceAdapter({ providerKey: finalModelKey });
    default:
      throw new Error(
        `Voice vendor "${config.vendor}" is not supported yet.`,
      );
  }
}

export function getMusicAdapter(
  options: MusicAdapterFactoryOptions = {},
): MusicGenerationAdapter {
  const targetModelKey = options.modelKey
    ? options.modelKey
    : defaultMusicModelForVendor(options.vendor);
  const finalModelKey = findModelKey(
    "music_generation",
    options.vendor,
    targetModelKey,
  );
  const config = AUDIO_MODELS[finalModelKey];

  switch (config.vendor) {
    case "replicate":
      return new ReplicateMusicAdapter(finalModelKey);
    default:
      throw new Error(
        `Music vendor "${config.vendor}" is not supported yet.`,
      );
  }
}

export function getSoundLibraryAdapter(
  options: SoundLibraryAdapterFactoryOptions = {},
): SoundLibraryAdapter {
  const finalModelKey = findModelKey(
    "sound_library",
    options.vendor ?? "freesound",
    options.modelKey,
  );
  const config = AUDIO_MODELS[finalModelKey];

  switch (config.vendor) {
    case "freesound":
      return new FreesoundAudioAdapter(finalModelKey);
    default:
      throw new Error(
        `Sound library vendor "${config.vendor}" is not supported yet.`,
      );
  }
}
