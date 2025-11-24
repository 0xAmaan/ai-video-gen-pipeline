import type { MediaFile } from "./types/media";
import type { TimelineTrack } from "./types/timeline";
import type { SavedSoundsData, SoundEffect, SavedSound } from "./types/sounds";
import type { TProject } from "./types/project";
import type { Project } from "@/lib/editor/types";
import { buildProjectFromTimeline } from "./project-sync";

type TimelineKey = `${string}::${string}`;

const timelineKey = (projectId: string, sceneId?: string): TimelineKey =>
  `${projectId}::${sceneId ?? "default"}`;

const clone = <T>(value: T): T => {
  if (typeof structuredClone === "function") {
    return structuredClone(value);
  }
  return JSON.parse(JSON.stringify(value));
};

const cloneMedia = (media: MediaFile): MediaFile => {
  if (typeof structuredClone === "function") {
    return structuredClone(media);
  }
  // File instances can't be serialized with JSON.stringify, so fall back to shallow clone.
  return { ...media };
};

const cloneProjectDeep = (project: Project): Project => ({
  ...project,
  sequences: project.sequences.map((sequence) => ({
    ...sequence,
    tracks: sequence.tracks.map((track) => ({
      ...track,
      clips: track.clips.map((clip) => ({ ...clip })),
    })),
  })),
  mediaAssets: { ...project.mediaAssets },
});

const persistProjectToConvex = async (
  projectId: string,
  project: Project,
): Promise<void> => {
  if (typeof fetch !== "function") return;
  try {
    await fetch("/api/editor-state", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectId,
        projectData: project,
        sequenceNumber: Date.now(),
      }),
    });
  } catch (error) {
    console.warn("persistProjectToConvex failed", error);
  }
};

export interface OpenCutSnapshot {
  project: TProject;
  mediaFiles: MediaFile[];
  timeline: TimelineTrack[];
  sceneId?: string;
}

class InMemoryStorageService {
  private projects = new Map<string, TProject>();
  private projectMedia = new Map<string, Map<string, MediaFile>>();
  private timelines = new Map<TimelineKey, TimelineTrack[]>();
  private savedSounds: SavedSoundsData = {
    sounds: [],
    lastModified: new Date().toISOString(),
  };
  private convexSyncContexts = new Map<string, { convexProjectId: string; baseProject: Project }>();
  private syncTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private syncingProjects = new Set<string>();
  private pendingSyncs = new Set<string>();

  hydrateFromSnapshot(snapshot: OpenCutSnapshot) {
    this.reset(snapshot.project.id);
    void this.saveProject({ project: snapshot.project });

    const mediaBucket = new Map<string, MediaFile>();
    snapshot.mediaFiles.forEach((item) => {
      mediaBucket.set(item.id, cloneMedia(item));
    });
    this.projectMedia.set(snapshot.project.id, mediaBucket);

    const key = timelineKey(
      snapshot.project.id,
      snapshot.sceneId ?? snapshot.project.currentSceneId,
    );
    this.timelines.set(key, clone(snapshot.timeline));
  }

  configureConvexSync({
    project,
    convexProjectId,
  }: {
    project: Project;
    convexProjectId: string;
  }) {
    this.convexSyncContexts.set(project.id, {
      convexProjectId,
      baseProject: cloneProjectDeep(project),
    });
  }

  reset(projectId?: string) {
    if (!projectId) {
      this.projects.clear();
      this.projectMedia.clear();
      this.timelines.clear();
      this.convexSyncContexts.clear();
      return;
    }

    this.projects.delete(projectId);
    this.projectMedia.delete(projectId);
    this.convexSyncContexts.delete(projectId);
    for (const key of Array.from(this.timelines.keys())) {
      if (key.startsWith(`${projectId}::`)) {
        this.timelines.delete(key);
      }
    }
  }

  async saveProject({ project }: { project: TProject }): Promise<void> {
    this.projects.set(project.id, clone(project));
    this.scheduleConvexSync(project.id);
  }

  async loadProject({ id }: { id: string }): Promise<TProject | null> {
    const project = this.projects.get(id);
    return project ? clone(project) : null;
  }

  async loadAllProjects(): Promise<TProject[]> {
    return Array.from(this.projects.values()).map((project) => clone(project));
  }

  async deleteProject({ id }: { id: string }): Promise<void> {
    this.reset(id);
  }

  async saveMediaFile({
    projectId,
    mediaItem,
  }: {
    projectId: string;
    mediaItem: MediaFile;
  }): Promise<void> {
    const bucket =
      this.projectMedia.get(projectId) ?? new Map<string, MediaFile>();
    bucket.set(mediaItem.id, cloneMedia(mediaItem));
    this.projectMedia.set(projectId, bucket);
  }

  async loadMediaFile({
    projectId,
    id,
  }: {
    projectId: string;
    id: string;
  }): Promise<MediaFile | null> {
    const bucket = this.projectMedia.get(projectId);
    if (!bucket) return null;
    const media = bucket.get(id);
    return media ? cloneMedia(media) : null;
  }

  async loadAllMediaFiles({
    projectId,
  }: {
    projectId: string;
  }): Promise<MediaFile[]> {
    const bucket = this.projectMedia.get(projectId);
    if (!bucket) return [];
    return Array.from(bucket.values()).map((item) => cloneMedia(item));
  }

  async deleteMediaFile({
    projectId,
    id,
  }: {
    projectId: string;
    id: string;
  }): Promise<void> {
    const bucket = this.projectMedia.get(projectId);
    bucket?.delete(id);
  }

  async deleteProjectMedia({
    projectId,
  }: {
    projectId: string;
  }): Promise<void> {
    this.projectMedia.delete(projectId);
  }

  async saveTimeline({
    projectId,
    tracks,
    sceneId,
  }: {
    projectId: string;
    tracks: TimelineTrack[];
    sceneId?: string;
  }): Promise<void> {
    this.timelines.set(timelineKey(projectId, sceneId), clone(tracks));
    this.scheduleConvexSync(projectId);
  }

  async loadTimeline({
    projectId,
    sceneId,
  }: {
    projectId: string;
    sceneId?: string;
  }): Promise<TimelineTrack[] | null> {
    const data = this.timelines.get(timelineKey(projectId, sceneId));
    return data ? clone(data) : null;
  }

  async deleteProjectTimeline({
    projectId,
  }: {
    projectId: string;
  }): Promise<void> {
    for (const key of Array.from(this.timelines.keys())) {
      if (key.startsWith(`${projectId}::`)) {
        this.timelines.delete(key);
      }
    }
  }

  private scheduleConvexSync(projectId: string) {
    if (!this.convexSyncContexts.has(projectId)) {
      return;
    }
    const timer = this.syncTimers.get(projectId);
    if (timer) {
      clearTimeout(timer);
    }
    const handle = setTimeout(() => {
      this.syncTimers.delete(projectId);
      void this.performConvexSync(projectId);
    }, 300);
    this.syncTimers.set(projectId, handle);
  }

  private async performConvexSync(projectId: string): Promise<void> {
    if (this.syncingProjects.has(projectId)) {
      this.pendingSyncs.add(projectId);
      return;
    }
    this.syncingProjects.add(projectId);
    try {
      await this.syncProjectNow(projectId);
    } finally {
      this.syncingProjects.delete(projectId);
      if (this.pendingSyncs.has(projectId)) {
        this.pendingSyncs.delete(projectId);
        void this.performConvexSync(projectId);
      }
    }
  }

  private async syncProjectNow(projectId: string): Promise<void> {
    const context = this.convexSyncContexts.get(projectId);
    if (!context) {
      return;
    }

    const projectMeta = await this.loadProject({ id: projectId });
    if (!projectMeta) {
      return;
    }

    const tracks = await this.loadTimeline({
      projectId,
      sceneId: projectMeta.currentSceneId,
    });
    if (!tracks) {
      return;
    }

    const nextProject = buildProjectFromTimeline({
      baseProject: context.baseProject,
      timeline: tracks,
      projectMeta,
    });

    await persistProjectToConvex(context.convexProjectId, nextProject);
    context.baseProject = cloneProjectDeep(nextProject);
  }

  async clearAllData(): Promise<void> {
    this.reset();
    this.savedSounds = {
      sounds: [],
      lastModified: new Date().toISOString(),
    };
  }

  async getStorageInfo(): Promise<{
    projects: number;
    isOPFSSupported: boolean;
    isIndexedDBSupported: boolean;
  }> {
    return {
      projects: this.projects.size,
      isOPFSSupported: true,
      isIndexedDBSupported: true,
    };
  }

  async getProjectStorageInfo({
    projectId,
  }: {
    projectId: string;
  }): Promise<{ mediaItems: number; hasTimeline: boolean }> {
    const mediaItems = this.projectMedia.get(projectId)?.size ?? 0;
    const hasTimeline = Array.from(this.timelines.keys()).some((key) =>
      key.startsWith(`${projectId}::`),
    );
    return { mediaItems, hasTimeline };
  }

  async loadSavedSounds(): Promise<SavedSoundsData> {
    return clone(this.savedSounds);
  }

  async saveSoundEffect({
    soundEffect,
  }: {
    soundEffect: SoundEffect;
  }): Promise<void> {
    const current = await this.loadSavedSounds();
    if (
      current.sounds.some((sound: SavedSound) => sound.id === soundEffect.id)
    ) {
      return;
    }

    const savedSound: SavedSound = {
      id: soundEffect.id,
      name: soundEffect.name,
      username: soundEffect.username,
      previewUrl: soundEffect.previewUrl,
      downloadUrl: soundEffect.downloadUrl,
      duration: soundEffect.duration,
      tags: soundEffect.tags,
      license: soundEffect.license,
      savedAt: new Date().toISOString(),
    };

    this.savedSounds = {
      sounds: [...current.sounds, savedSound],
      lastModified: new Date().toISOString(),
    };
  }

  async removeSavedSound({ soundId }: { soundId: number }): Promise<void> {
    const current = await this.loadSavedSounds();
    this.savedSounds = {
      sounds: current.sounds.filter(
        (sound: SavedSound) => sound.id !== soundId,
      ),
      lastModified: new Date().toISOString(),
    };
  }

  async isSoundSaved({ soundId }: { soundId: number }): Promise<boolean> {
    const current = await this.loadSavedSounds();
    return current.sounds.some((sound: SavedSound) => sound.id === soundId);
  }

  async clearSavedSounds(): Promise<void> {
    this.savedSounds = {
      sounds: [],
      lastModified: new Date().toISOString(),
    };
  }

  isOPFSSupported(): boolean {
    return true;
  }

  isIndexedDBSupported(): boolean {
    return true;
  }

  isFullySupported(): boolean {
    return true;
  }
}

export const storageService = new InMemoryStorageService();
export { InMemoryStorageService as StorageService };
