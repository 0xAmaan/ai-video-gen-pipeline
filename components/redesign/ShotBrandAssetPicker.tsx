"use client";

import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { ProjectAsset } from "@/lib/types/redesign";
import type { Id } from "@/convex/_generated/dataModel";
import { Check, Plus, X } from "lucide-react";
import { toast } from "sonner";
import { proxiedImageUrl } from "@/lib/redesign/image-proxy";

const MAX_ASSETS_PER_SHOT = 3;
const EMPTY_ASSET_IDS: Id<"projectAssets">[] = [];

interface ShotBrandAssetPickerProps {
  label: string;
  assets?: ProjectAsset[];
  selectedAssetIds?: Id<"projectAssets">[];
  onChange: (assetIds: Id<"projectAssets">[]) => void;
}

export const ShotBrandAssetPicker = ({
  label,
  assets = [],
  selectedAssetIds,
  onChange,
}: ShotBrandAssetPickerProps) => {
  const safeSelectedAssetIds = selectedAssetIds ?? EMPTY_ASSET_IDS;
  const [open, setOpen] = useState(false);
  const [tempSelection, setTempSelection] = useState<Id<"projectAssets">[]>(safeSelectedAssetIds);
  const [shakeId, setShakeId] = useState<Id<"projectAssets"> | null>(null);

  useEffect(() => {
    if (!open) return;
    setTempSelection(safeSelectedAssetIds);
    setShakeId(null);
  }, [open, safeSelectedAssetIds]);

  const selectedAssets = useMemo(
    () => assets.filter((asset) => safeSelectedAssetIds.includes(asset._id)),
    [assets, safeSelectedAssetIds],
  );

  const gridItems = useMemo(() => {
    const count = Math.max(1, assets.length);
    const totalCells = Math.max(5, Math.ceil(count / 5) * 5);
    return Array.from({ length: totalCells }, (_, index) => assets[index]);
  }, [assets]);

  const handleToggleAsset = (assetId: Id<"projectAssets">) => {
    const isSelected = tempSelection.includes(assetId);
    if (!isSelected && tempSelection.length >= MAX_ASSETS_PER_SHOT) {
      setShakeId(assetId);
      toast.error("Each shot can have max 3 images.");
      setTimeout(() => setShakeId(null), 450);
      return;
    }

    setTempSelection((prev) =>
      isSelected ? prev.filter((id) => id !== assetId) : [...prev, assetId],
    );
  };

  const handleConfirm = () => {
    onChange(tempSelection.slice(0, MAX_ASSETS_PER_SHOT));
    setOpen(false);
  };

  const handleRemove = (assetId: Id<"projectAssets">, event?: React.MouseEvent) => {
    event?.stopPropagation();
    const next = safeSelectedAssetIds.filter((id) => id !== assetId);
    onChange(next);
  };

  const canAddMore = safeSelectedAssetIds.length < MAX_ASSETS_PER_SHOT;
  const hasAssets = assets.length > 0;

  return (
    <>
      <div className="flex items-center gap-2 flex-wrap">
        {selectedAssets.map((asset) => (
          <button
            key={asset._id}
            type="button"
            onClick={(event) => handleRemove(asset._id, event)}
            className="group relative h-10 w-16 overflow-hidden rounded-full border border-white/15 bg-white/5"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={proxiedImageUrl(asset.imageUrl) || asset.imageUrl}
              alt={asset.name}
              className="h-full w-full object-cover"
            />
            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition flex items-center justify-center">
              <X className="h-4 w-4 text-white" />
            </div>
          </button>
        ))}

        {canAddMore && (
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setOpen(true);
            }}
            className="h-10 w-14 rounded-full border border-white/10 bg-white/5 text-gray-200 flex items-center justify-center hover:border-white/30 hover:bg-white/10 transition"
            aria-label="Add brand asset"
          >
            <Plus className="h-4 w-4" />
          </button>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-full max-w-3xl bg-[#0e0e0e] border border-white/10 text-white">
          <DialogHeader>
            <DialogTitle>Select brand assets for {label}</DialogTitle>
          </DialogHeader>

          <div className="space-y-3">
            {!hasAssets && (
              <p className="text-sm text-gray-500">
                No uploads yet. Add images on the input step, then attach up to three per shot.
              </p>
            )}
            <div className="max-w-full overflow-x-hidden pb-1 pt-1">
              <div className="grid grid-cols-5 gap-3 w-full">
                {gridItems.map((asset, index) =>
                  asset ? (
                    <button
                      key={asset._id}
                      type="button"
                      onClick={() => handleToggleAsset(asset._id)}
                      className={cn(
                        "group relative h-28 w-full rounded-2xl border border-white/10 bg-black/40 transition",
                        tempSelection.includes(asset._id)
                          ? "border-transparent ring-2 ring-white/90 ring-offset-[3px] ring-offset-[#0e0e0e]"
                          : "hover:border-white/40",
                        shakeId === asset._id &&
                          "ring-2 ring-red-500/70 ring-offset-2 ring-offset-[#0e0e0e] animate-shot-wiggle",
                      )}
                    >
                      <div className="absolute inset-0 rounded-2xl overflow-hidden">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={proxiedImageUrl(asset.imageUrl) || asset.imageUrl}
                          alt={asset.name}
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-black/0" />
                      </div>
                      {tempSelection.includes(asset._id) && (
                        <div className="relative z-10 flex h-full w-full items-center justify-center">
                          <div className="h-9 w-9 rounded-full bg-black/70 flex items-center justify-center">
                            <Check className="h-5 w-5 text-white" />
                          </div>
                        </div>
                      )}
                    </button>
                  ) : (
                    <div
                      key={`placeholder-${index}`}
                      className="h-28 w-full rounded-2xl border border-dashed border-white/10 bg-white/[0.02]"
                    />
                  ),
                )}
              </div>
            </div>
          </div>

          <DialogFooter className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              className="border-white/20 text-gray-300"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleConfirm}
              disabled={!hasAssets}
              className={cn(
                "bg-white text-black hover:bg-gray-200",
                !hasAssets && "opacity-50 cursor-not-allowed",
              )}
            >
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style jsx global>{`
        @keyframes shot-wiggle {
          0%,
          100% {
            transform: translateX(0);
          }
          20% {
            transform: translateX(-4px);
          }
          40% {
            transform: translateX(4px);
          }
          60% {
            transform: translateX(-3px);
          }
          80% {
            transform: translateX(3px);
          }
        }
        .animate-shot-wiggle {
          animation: shot-wiggle 0.35s ease-in-out;
        }
      `}</style>
    </>
  );
};
