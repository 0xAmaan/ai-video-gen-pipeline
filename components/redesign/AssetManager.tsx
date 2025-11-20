"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { AssetFormDialog, AssetFormValues } from "./AssetFormDialog";
import {
  useProjectAssets,
  useCreateProjectAsset,
  useUpdateProjectAsset,
  useToggleProjectAsset,
  useDeleteProjectAsset,
} from "@/lib/hooks/useProjectRedesign";
import type { Id } from "@/convex/_generated/dataModel";
import type { ProjectAsset } from "@/lib/types/redesign";
import { cn } from "@/lib/utils";
import { Loader2, Plus, Eye, EyeOff, Pencil, Trash2 } from "lucide-react";

interface AssetManagerProps {
  projectId?: Id<"videoProjects">;
}

export const AssetManager = ({ projectId }: AssetManagerProps) => {
  const assets = useProjectAssets(projectId, { includeInactive: true });
  const createAsset = useCreateProjectAsset();
  const updateAsset = useUpdateProjectAsset();
  const toggleAsset = useToggleProjectAsset();
  const deleteAsset = useDeleteProjectAsset();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"create" | "edit">("create");
  const [editingAsset, setEditingAsset] = useState<ProjectAsset | null>(null);
  const [saving, setSaving] = useState(false);
  const [pendingAction, setPendingAction] = useState<Id<"projectAssets"> | null>(null);

  const sortedAssets = useMemo(() => {
    if (!assets) return [];
    return [...assets].sort((a, b) => {
      if (a.isActive === b.isActive) {
        return b.createdAt - a.createdAt;
      }
      return a.isActive ? -1 : 1;
    });
  }, [assets]);

  const handleDialogSubmit = async (values: AssetFormValues) => {
    if (!projectId) {
      toast.error("Create a project first before adding assets.");
      return;
    }

    setSaving(true);
    try {
      if (dialogMode === "edit" && editingAsset) {
        await updateAsset({
          assetId: editingAsset._id,
          name: values.name,
          description: values.description,
          imageUrl: values.imageUrl,
          usageNotes: values.usageNotes,
          prominence: values.prominence,
          img2imgStrength: values.img2imgStrength,
          assetType: values.assetType,
        });
        toast.success("Asset updated");
      } else {
        await createAsset({
          projectId,
          assetType: values.assetType,
          name: values.name,
          description: values.description,
          imageUrl: values.imageUrl,
          usageNotes: values.usageNotes,
          prominence: values.prominence,
          img2imgStrength: values.img2imgStrength,
        });
        toast.success("Asset added");
      }
      setDialogOpen(false);
      setEditingAsset(null);
    } catch (error) {
      console.error(error);
      toast.error("Unable to save asset. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  const handleAddClick = () => {
    setDialogMode("create");
    setEditingAsset(null);
    setDialogOpen(true);
  };

  const handleEditClick = (asset: ProjectAsset) => {
    setDialogMode("edit");
    setEditingAsset(asset);
    setDialogOpen(true);
  };

  const handleToggleActive = async (asset: ProjectAsset) => {
    setPendingAction(asset._id);
    try {
      await toggleAsset({ assetId: asset._id });
      toast.success(asset.isActive ? "Asset hidden" : "Asset reactivated");
    } catch (error) {
      console.error(error);
      toast.error("Could not update asset state");
    } finally {
      setPendingAction(null);
    }
  };

  const handleDelete = async (asset: ProjectAsset) => {
    const confirmDelete = window.confirm(
      `Delete "${asset.name}"? This cannot be undone.`,
    );
    if (!confirmDelete) return;

    setPendingAction(asset._id);
    try {
      await deleteAsset({ assetId: asset._id });
      toast.success("Asset deleted");
    } catch (error) {
      console.error(error);
      toast.error("Unable to delete asset");
    } finally {
      setPendingAction(null);
    }
  };

  const renderAssetCard = (asset: ProjectAsset) => {
    const inactive = !asset.isActive;
    return (
      <Card
        key={asset._id}
        className={cn(
          "border-white/10 bg-[#111] text-white overflow-hidden flex flex-col",
          inactive && "opacity-60",
        )}
      >
        <div className="relative h-40 bg-black/40">
          {asset.imageUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={asset.imageUrl}
              alt={asset.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="h-full w-full flex items-center justify-center text-xs text-gray-500">
              No image
            </div>
          )}
          <div className="absolute top-3 right-3 flex gap-2">
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full bg-black/60 text-white"
              onClick={() => handleToggleActive(asset)}
              disabled={pendingAction === asset._id}
            >
              {pendingAction === asset._id ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : asset.isActive ? (
                <EyeOff className="w-4 h-4" />
              ) : (
                <Eye className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full bg-black/60 text-white"
              onClick={() => handleEditClick(asset)}
            >
              <Pencil className="w-4 h-4" />
            </Button>
            <Button
              size="icon"
              variant="secondary"
              className="h-8 w-8 rounded-full bg-black/60 text-red-300"
              onClick={() => handleDelete(asset)}
              disabled={pendingAction === asset._id}
            >
              <Trash2 className="w-4 h-4" />
            </Button>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-2">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="font-semibold">{asset.name}</p>
              <p className="text-xs uppercase tracking-wide text-gray-500">
                {asset.assetType}
              </p>
            </div>
            {asset.prominence && (
              <Badge
                className={cn(
                  "text-xs",
                  asset.prominence === "primary" && "bg-emerald-500/20 text-emerald-200",
                  asset.prominence === "secondary" && "bg-blue-500/20 text-blue-200",
                  asset.prominence === "subtle" && "bg-yellow-500/20 text-yellow-200",
                )}
              >
                {asset.prominence}
              </Badge>
            )}
          </div>

          {asset.description && (
            <p className="text-xs text-gray-300 line-clamp-2">{asset.description}</p>
          )}
          {asset.usageNotes && (
            <p className="text-xs text-gray-500 line-clamp-2">
              Usage: {asset.usageNotes}
            </p>
          )}
          {asset.img2imgStrength !== undefined && (
            <p className="text-[11px] text-gray-500">
              Img2Img influence: {Math.round(asset.img2imgStrength * 100)}%
            </p>
          )}
        </div>
      </Card>
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.3em] text-gray-500">
            Brand assets
          </p>
          <h3 className="text-xl font-semibold text-white mt-1">
            Keep every shot on-brand
          </h3>
          <p className="text-sm text-gray-400">
            Upload logos, hero products, or reference characters the AI should honor.
          </p>
        </div>
        <Button
          onClick={handleAddClick}
          disabled={!projectId}
          className="bg-white text-black hover:bg-gray-200"
        >
          <Plus className="w-4 h-4 mr-2" />
          Add asset
        </Button>
      </div>

      {!projectId ? (
        <div className="border border-dashed border-white/10 rounded-2xl p-6 text-gray-500 text-sm">
          Create a project to start adding brand assets.
        </div>
      ) : assets === undefined ? (
        <div className="border border-white/10 rounded-2xl p-8 flex items-center justify-center">
          <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
        </div>
      ) : sortedAssets.length === 0 ? (
        <div className="border border-dashed border-white/10 rounded-2xl p-6 text-gray-400 text-sm">
          No assets yet. Add your logos, products, or characters so the AI keeps them
          consistent across every scene.
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {sortedAssets.map(renderAssetCard)}
        </div>
      )}

      <AssetFormDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setEditingAsset(null);
          }
        }}
        mode={dialogMode}
        initialValues={
          editingAsset
            ? {
                assetType: editingAsset.assetType,
                name: editingAsset.name,
                description: editingAsset.description,
                usageNotes: editingAsset.usageNotes,
                prominence: editingAsset.prominence,
                img2imgStrength: editingAsset.img2imgStrength,
                imageUrl: editingAsset.imageUrl,
              }
            : undefined
        }
        onSubmit={handleDialogSubmit}
        isSubmitting={saving}
      />
    </div>
  );
};
