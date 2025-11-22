import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Doc, Id } from "@/convex/_generated/dataModel";

export type BrandAssetDoc = Doc<"brandAssets"> & { imageUrl?: string | null };

export const useBrandAssets = (enabled: boolean = true) => {
  return useQuery(
    api.brandAssets.getBrandAssets,
    enabled ? {} : "skip",
  ) as BrandAssetDoc[] | undefined;
};

export const useCreateBrandAsset = () => {
  return useMutation(api.brandAssets.createBrandAsset);
};

export const useUpdateBrandAsset = () => {
  return useMutation(api.brandAssets.updateBrandAsset);
};

export const useDeleteBrandAsset = () => {
  return useMutation(api.brandAssets.deleteBrandAsset);
};

export const useGenerateBrandAssetUploadUrl = () => {
  return useMutation(api.brandAssets.generateUploadUrl);
};

export const useImportBrandAssets = () => {
  return useMutation(api.projectAssets.importBrandAssets);
};
