import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore } from './project-store';
import type { MediaAssetMeta } from '../types';

// Mock IndexedDB
vi.mock('./persistence', () => ({
  ProjectPersistence: {
    load: vi.fn().mockResolvedValue(null),
    save: vi.fn().mockResolvedValue(undefined),
  },
}));

describe('ProjectStore - updateMediaAsset', () => {
  beforeEach(() => {
    // Reset store state before each test
    const { actions } = useProjectStore.getState();
    actions.reset();
  });

  const createMockAsset = (id: string): MediaAssetMeta => ({
    id,
    name: `Test Asset ${id}`,
    type: 'video',
    duration: 5,
    width: 1920,
    height: 1080,
    fps: 30,
    url: `https://example.com/${id}.mp4`,
  });

  describe('Basic Update Functionality', () => {
    it('should update existing asset with new properties', async () => {
      const { actions } = useProjectStore.getState();

      // Setup: Create a project with an asset
      const asset = createMockAsset('asset-1');
      await actions.hydrate();
      actions.addMediaAsset(asset);

      // Update with thumbnails
      const thumbnails = ['thumb1', 'thumb2', 'thumb3'];
      actions.updateMediaAsset('asset-1', {
        thumbnails,
        thumbnailCount: thumbnails.length,
      });

      // Verify update
      const { project } = useProjectStore.getState();
      expect(project?.mediaAssets['asset-1']).toBeDefined();
      expect(project?.mediaAssets['asset-1'].thumbnails).toEqual(thumbnails);
      expect(project?.mediaAssets['asset-1'].thumbnailCount).toBe(3);

      // Original properties should be preserved
      expect(project?.mediaAssets['asset-1'].id).toBe('asset-1');
      expect(project?.mediaAssets['asset-1'].name).toBe('Test Asset asset-1');
      expect(project?.mediaAssets['asset-1'].duration).toBe(5);
    });

    it('should handle partial updates', async () => {
      const { actions } = useProjectStore.getState();

      const asset = createMockAsset('asset-1');
      await actions.hydrate();
      actions.addMediaAsset(asset);

      // Update only thumbnails
      actions.updateMediaAsset('asset-1', {
        thumbnails: ['thumb1'],
      });

      const { project } = useProjectStore.getState();
      expect(project?.mediaAssets['asset-1'].thumbnails).toEqual(['thumb1']);
      expect(project?.mediaAssets['asset-1'].thumbnailCount).toBeUndefined();
    });

    it('should update multiple properties at once', async () => {
      const { actions } = useProjectStore.getState();

      const asset = createMockAsset('asset-1');
      await actions.hydrate();
      actions.addMediaAsset(asset);

      actions.updateMediaAsset('asset-1', {
        thumbnails: ['thumb1', 'thumb2'],
        thumbnailCount: 2,
        waveform: new Float32Array([0.1, 0.2, 0.3]),
      });

      const { project } = useProjectStore.getState();
      expect(project?.mediaAssets['asset-1'].thumbnails).toHaveLength(2);
      expect(project?.mediaAssets['asset-1'].thumbnailCount).toBe(2);
      expect(project?.mediaAssets['asset-1'].waveform).toBeInstanceOf(Float32Array);
    });
  });

  describe('Edge Cases', () => {
    it('should handle non-existent asset gracefully', async () => {
      const { actions } = useProjectStore.getState();
      await actions.hydrate();

      const stateBefore = useProjectStore.getState();

      // Try to update non-existent asset
      actions.updateMediaAsset('non-existent', {
        thumbnails: ['thumb1'],
      });

      const stateAfter = useProjectStore.getState();

      // State should remain unchanged
      expect(stateBefore).toEqual(stateAfter);
    });

    it('should handle update when project is null', () => {
      const { actions } = useProjectStore.getState();
      // Don't hydrate - project will be null

      const stateBefore = useProjectStore.getState();

      actions.updateMediaAsset('asset-1', {
        thumbnails: ['thumb1'],
      });

      const stateAfter = useProjectStore.getState();

      expect(stateBefore).toEqual(stateAfter);
      expect(stateAfter.project).toBeNull();
    });

    it('should handle empty updates object', async () => {
      const { actions } = useProjectStore.getState();

      const asset = createMockAsset('asset-1');
      await actions.hydrate();
      actions.addMediaAsset(asset);

      const assetBefore = useProjectStore.getState().project?.mediaAssets['asset-1'];

      actions.updateMediaAsset('asset-1', {});

      const assetAfter = useProjectStore.getState().project?.mediaAssets['asset-1'];

      expect(assetAfter).toEqual(assetBefore);
    });
  });

  describe('Immutability', () => {
    it('should not mutate original asset object', async () => {
      const { actions } = useProjectStore.getState();

      const asset = createMockAsset('asset-1');
      await actions.hydrate();
      actions.addMediaAsset(asset);

      const originalAsset = useProjectStore.getState().project?.mediaAssets['asset-1'];
      const originalRef = originalAsset;

      actions.updateMediaAsset('asset-1', {
        thumbnails: ['thumb1'],
      });

      const updatedAsset = useProjectStore.getState().project?.mediaAssets['asset-1'];

      // Should be a new object reference
      expect(updatedAsset).not.toBe(originalRef);
    });
  });

  describe('Project Metadata', () => {
    it('should update project updatedAt timestamp', async () => {
      const { actions } = useProjectStore.getState();

      const asset = createMockAsset('asset-1');
      await actions.hydrate();
      actions.addMediaAsset(asset);

      const beforeUpdate = useProjectStore.getState().project?.updatedAt ?? 0;

      // Wait a bit to ensure timestamp changes
      await new Promise((resolve) => setTimeout(resolve, 10));

      actions.updateMediaAsset('asset-1', {
        thumbnails: ['thumb1'],
      });

      const afterUpdate = useProjectStore.getState().project?.updatedAt ?? 0;

      expect(afterUpdate).toBeGreaterThan(beforeUpdate);
    });
  });

  describe('Multiple Assets', () => {
    it('should update only the specified asset', async () => {
      const { actions } = useProjectStore.getState();

      await actions.hydrate();
      actions.addMediaAsset(createMockAsset('asset-1'));
      actions.addMediaAsset(createMockAsset('asset-2'));
      actions.addMediaAsset(createMockAsset('asset-3'));

      // Update only asset-2
      actions.updateMediaAsset('asset-2', {
        thumbnails: ['thumb1', 'thumb2'],
      });

      const { project } = useProjectStore.getState();

      expect(project?.mediaAssets['asset-1'].thumbnails).toBeUndefined();
      expect(project?.mediaAssets['asset-2'].thumbnails).toEqual(['thumb1', 'thumb2']);
      expect(project?.mediaAssets['asset-3'].thumbnails).toBeUndefined();
    });

    it('should handle sequential updates to different assets', async () => {
      const { actions } = useProjectStore.getState();

      await actions.hydrate();
      actions.addMediaAsset(createMockAsset('asset-1'));
      actions.addMediaAsset(createMockAsset('asset-2'));

      actions.updateMediaAsset('asset-1', { thumbnails: ['thumb1'] });
      actions.updateMediaAsset('asset-2', { thumbnails: ['thumb2'] });

      const { project } = useProjectStore.getState();

      expect(project?.mediaAssets['asset-1'].thumbnails).toEqual(['thumb1']);
      expect(project?.mediaAssets['asset-2'].thumbnails).toEqual(['thumb2']);
    });

    it('should handle sequential updates to same asset', async () => {
      const { actions } = useProjectStore.getState();

      await actions.hydrate();
      actions.addMediaAsset(createMockAsset('asset-1'));

      actions.updateMediaAsset('asset-1', { thumbnails: ['thumb1'] });
      actions.updateMediaAsset('asset-1', { thumbnailCount: 1 });
      actions.updateMediaAsset('asset-1', { thumbnails: ['thumb1', 'thumb2'] });

      const { project } = useProjectStore.getState();

      // Last update should win
      expect(project?.mediaAssets['asset-1'].thumbnails).toEqual(['thumb1', 'thumb2']);
      expect(project?.mediaAssets['asset-1'].thumbnailCount).toBe(1);
    });
  });

  describe('Type Safety', () => {
    it('should preserve type information', async () => {
      const { actions } = useProjectStore.getState();

      const asset = createMockAsset('asset-1');
      await actions.hydrate();
      actions.addMediaAsset(asset);

      actions.updateMediaAsset('asset-1', {
        thumbnails: ['data:image/jpeg;base64,abc'],
        thumbnailCount: 1,
      });

      const { project } = useProjectStore.getState();
      const updatedAsset = project?.mediaAssets['asset-1'];

      expect(updatedAsset?.type).toBe('video');
      expect(Array.isArray(updatedAsset?.thumbnails)).toBe(true);
      expect(typeof updatedAsset?.thumbnailCount).toBe('number');
    });
  });
});
