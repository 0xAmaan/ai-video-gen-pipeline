import type { Clip, MediaAssetMeta, Sequence, Track } from "../types";

export interface AudioTrackNode {
  track: Track;
  gainNode: GainNode;
  clips: Map<string, AudioClipNode>;
}

export interface AudioClipNode {
  clip: Clip;
  source?: AudioBufferSourceNode;
  startedAt: number;
  offset: number;
}

/**
 * AudioMixer manages multi-track audio playback and mixing
 * Handles per-track volume, mute, solo, and master volume
 */
export class AudioMixer {
  private audioContext: AudioContext;
  private masterGain: GainNode;
  private trackNodes: Map<string, AudioTrackNode> = new Map();
  private audioBuffers: Map<string, AudioBuffer> = new Map();
  private audioLoadPromises: Map<string, Promise<void>> = new Map();
  private audioSources: Map<string, AudioBufferSourceNode> = new Map();
  private currentTime: number = 0;
  private isPlaying: boolean = false;
  private startedPlaybackAt: number = 0;

  constructor(
    private readonly getSequence: () => Sequence | null,
    private readonly getAsset: (id: string) => MediaAssetMeta | undefined,
  ) {
    this.audioContext = new AudioContext({ sampleRate: 48000 });
    this.masterGain = this.audioContext.createGain();
    this.masterGain.connect(this.audioContext.destination);
  }

  /**
   * Preload audio assets into memory
   */
  async preloadAudioAssets(
    assets: Record<string, MediaAssetMeta>,
  ): Promise<void> {
    const audioAssets = Object.values(assets).filter(
      (asset) => asset.type === "audio" && !!asset.url,
    );

    await Promise.all(
      audioAssets.map(async (asset) => {
        if (!this.audioLoadPromises.has(asset.id)) {
          this.audioLoadPromises.set(
            asset.id,
            this.loadAudioBuffer(asset.url).then((buffer) => {
              this.audioBuffers.set(asset.id, buffer);
            }),
          );
        }
        await this.audioLoadPromises.get(asset.id);
      }),
    );
  }

  /**
   * Load and decode audio buffer from URL
   */
  private async loadAudioBuffer(url: string): Promise<AudioBuffer> {
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer();
    return this.audioContext.decodeAudioData(arrayBuffer);
  }

  /**
   * Initialize track nodes for all audio tracks in sequence
   */
  private initializeTrackNodes(sequence: Sequence): void {
    const audioTracks = sequence.tracks.filter((t) => t.kind === "audio");

    // Remove tracks that no longer exist
    for (const trackId of this.trackNodes.keys()) {
      if (!audioTracks.find((t) => t.id === trackId)) {
        const trackNode = this.trackNodes.get(trackId);
        if (trackNode) {
          trackNode.gainNode.disconnect();
          this.trackNodes.delete(trackId);
        }
      }
    }

    // Add or update tracks
    for (const track of audioTracks) {
      let trackNode = this.trackNodes.get(track.id);
      if (!trackNode) {
        const gainNode = this.audioContext.createGain();
        gainNode.connect(this.masterGain);
        trackNode = {
          track,
          gainNode,
          clips: new Map(),
        };
        this.trackNodes.set(track.id, trackNode);
      }

      // Update track properties
      trackNode.track = track;
      this.updateTrackGain(track);
    }
  }

  /**
   * Update track gain based on volume, mute, and solo state
   */
  private updateTrackGain(track: Track): void {
    const trackNode = this.trackNodes.get(track.id);
    if (!trackNode) return;

    const sequence = this.getSequence();
    if (!sequence) return;

    // Check if any track is soloed
    const hasSoloedTracks = sequence.tracks.some(
      (t) => t.kind === "audio" && t.solo,
    );

    let gain = 0;
    if (track.muted) {
      gain = 0;
    } else if (hasSoloedTracks) {
      // If solo tracks exist, only play soloed tracks
      gain = track.solo ? track.volume : 0;
    } else {
      gain = track.volume;
    }

    trackNode.gainNode.gain.setValueAtTime(gain, this.audioContext.currentTime);
  }

  /**
   * Set master volume (0-1 range)
   */
  setMasterVolume(volume: number): void {
    this.masterGain.gain.setValueAtTime(
      Math.max(0, Math.min(2, volume)),
      this.audioContext.currentTime,
    );
  }

  /**
   * Update track volume
   */
  updateTrackVolume(trackId: string, volume: number): void {
    const sequence = this.getSequence();
    if (!sequence) return;

    const track = sequence.tracks.find((t) => t.id === trackId);
    if (!track) return;

    track.volume = volume;
    this.updateTrackGain(track);
  }

  /**
   * Toggle track mute
   */
  toggleTrackMute(trackId: string): void {
    const sequence = this.getSequence();
    if (!sequence) return;

    const track = sequence.tracks.find((t) => t.id === trackId);
    if (!track) return;

    track.muted = !track.muted;
    this.updateTrackGain(track);
  }

  /**
   * Toggle track solo
   */
  toggleTrackSolo(trackId: string): void {
    const sequence = this.getSequence();
    if (!sequence) return;

    const track = sequence.tracks.find((t) => t.id === trackId);
    if (!track) return;

    track.solo = !track.solo;

    // Update all track gains since solo state affects all tracks
    sequence.tracks.forEach((t) => {
      if (t.kind === "audio") {
        this.updateTrackGain(t);
      }
    });
  }

  /**
   * Find active audio clips at given time
   */
  private findActiveClips(time: number): Array<{ track: Track; clip: Clip }> {
    const sequence = this.getSequence();
    if (!sequence) return [];

    const activeClips: Array<{ track: Track; clip: Clip }> = [];

    for (const track of sequence.tracks) {
      if (track.kind !== "audio") continue;

      for (const clip of track.clips) {
        const clipEnd = clip.start + clip.duration;
        if (time >= clip.start && time < clipEnd) {
          activeClips.push({ track, clip });
        }
      }
    }

    return activeClips;
  }

  /**
   * Play audio from given time
   */
  async play(fromTime: number): Promise<void> {
    const sequence = this.getSequence();
    if (!sequence) return;

    this.initializeTrackNodes(sequence);
    this.stopAllSources();

    this.currentTime = fromTime;
    this.isPlaying = true;
    this.startedPlaybackAt = this.audioContext.currentTime;

    const activeClips = this.findActiveClips(fromTime);
    console.log(
      "[AudioMixer] play() called at time",
      fromTime,
      "found",
      activeClips.length,
      "active clips",
    );

    for (const { track, clip } of activeClips) {
      const asset = this.getAsset(clip.mediaId);
      if (!asset) continue;

      const buffer = this.audioBuffers.get(clip.mediaId);
      if (!buffer) continue;

      const trackNode = this.trackNodes.get(track.id);
      if (!trackNode) continue;

      // Calculate offset within clip
      const offsetInClip = fromTime - clip.start;
      const sourceOffset = clip.trimStart + offsetInClip;

      // Create and start source
      const source = this.audioContext.createBufferSource();
      source.buffer = buffer;

      // Apply clip volume
      const clipGain = this.audioContext.createGain();
      clipGain.gain.setValueAtTime(clip.volume, this.audioContext.currentTime);
      source.connect(clipGain);
      clipGain.connect(trackNode.gainNode);

      // Start playback
      const duration = clip.duration - offsetInClip;
      source.start(this.audioContext.currentTime, sourceOffset, duration);

      // Store source reference
      this.audioSources.set(clip.id, source);
      trackNode.clips.set(clip.id, {
        clip,
        source,
        startedAt: this.audioContext.currentTime,
        offset: sourceOffset,
      });

      // Clean up when finished
      source.onended = () => {
        trackNode.clips.delete(clip.id);
        this.audioSources.delete(clip.id);
      };
    }
  }

  /**
   * Pause audio playback
   */
  pause(): void {
    console.log(
      "[AudioMixer] pause() called, active sources:",
      this.audioSources.size,
    );
    this.isPlaying = false;
    this.stopAllSources();
    console.log(
      "[AudioMixer] pause() complete, remaining sources:",
      this.audioSources.size,
    );
  }

  /**
   * Seek to specific time
   */
  async seek(time: number): Promise<void> {
    console.log(
      "[AudioMixer] seek() called at time",
      time,
      "isPlaying:",
      this.isPlaying,
    );
    console.trace("[AudioMixer] seek() call stack:");

    // CRITICAL FIX: Don't modify isPlaying state during seek
    // Only stop and restart sources if we're currently playing
    const wasPlaying = this.isPlaying;

    // Stop all current sources
    this.stopAllSources();
    this.currentTime = time;

    // Only restart playback if we were playing before the seek
    // This preserves the play/pause state across seeks
    if (wasPlaying) {
      console.log("[AudioMixer] Restarting playback after seek");
      await this.play(time);
    } else {
      console.log("[AudioMixer] Not restarting playback (was paused)");
    }
  }

  /**
   * Stop all active audio sources
   */
  private stopAllSources(): void {
    console.log(
      "[AudioMixer] stopAllSources() called, stopping",
      this.audioSources.size,
      "sources",
    );
    for (const [clipId, source] of this.audioSources.entries()) {
      try {
        console.log("[AudioMixer] Stopping source for clip:", clipId);
        // CRITICAL FIX: Stop the source AND disconnect from audio graph
        // Just calling stop() doesn't immediately silence buffered audio
        source.stop();
        source.disconnect();
      } catch (error) {
        console.warn(
          "[AudioMixer] Error stopping source for clip:",
          clipId,
          error,
        );
      }
    }
    this.audioSources.clear();

    for (const trackNode of this.trackNodes.values()) {
      trackNode.clips.clear();
    }
    console.log("[AudioMixer] stopAllSources() complete");
  }

  /**
   * Get current playback time
   */
  getCurrentTime(): number {
    if (!this.isPlaying) {
      return this.currentTime;
    }
    const elapsed = this.audioContext.currentTime - this.startedPlaybackAt;
    return this.currentTime + elapsed;
  }

  /**
   * Resume audio context (needed after user interaction on some browsers)
   */
  async resume(): Promise<void> {
    if (this.audioContext.state === "suspended") {
      await this.audioContext.resume();
    }
  }

  /**
   * Cleanup and dispose resources
   */
  dispose(): void {
    this.stopAllSources();

    for (const trackNode of this.trackNodes.values()) {
      trackNode.gainNode.disconnect();
    }
    this.trackNodes.clear();

    this.masterGain.disconnect();
    this.audioBuffers.clear();
    this.audioLoadPromises.clear();

    // Don't close the audio context - it may be reused
    // this.audioContext.close();
  }
}
