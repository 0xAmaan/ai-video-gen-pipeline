"use client";

import { useEffect, useMemo, useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import type { AssetProminence, ProjectAssetType } from "@/lib/types/redesign";
import { ImageIcon } from "lucide-react";

export interface AssetFormValues {
  assetType: ProjectAssetType;
  name: string;
  imageUrl?: string;
  description?: string;
  usageNotes?: string;
  prominence?: AssetProminence;
  img2imgStrength?: number;
}

const DEFAULT_VALUES: AssetFormValues = {
  assetType: "logo",
  name: "",
  imageUrl: "",
  description: "",
  usageNotes: "",
  prominence: "primary",
  img2imgStrength: 0.6,
};

const assetTypeOptions: { value: ProjectAssetType; label: string }[] = [
  { value: "logo", label: "Logo" },
  { value: "product", label: "Product" },
  { value: "character", label: "Character" },
  { value: "background", label: "Background" },
  { value: "prop", label: "Prop" },
  { value: "reference", label: "Reference" },
  { value: "other", label: "Other" },
];

const prominenceOptions: { value: AssetProminence; label: string }[] = [
  { value: "primary", label: "Primary (must appear)" },
  { value: "secondary", label: "Secondary (nice-to-have)" },
  { value: "subtle", label: "Subtle (loose reference)" },
];

interface AssetFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode?: "create" | "edit";
  initialValues?: AssetFormValues | null;
  onSubmit: (values: AssetFormValues) => Promise<void> | void;
  isSubmitting?: boolean;
}

export const AssetFormDialog = ({
  open,
  onOpenChange,
  mode = "create",
  initialValues,
  onSubmit,
  isSubmitting,
}: AssetFormDialogProps) => {
  const [values, setValues] = useState<AssetFormValues>(DEFAULT_VALUES);

  useEffect(() => {
    if (initialValues) {
      setValues({
        ...DEFAULT_VALUES,
        ...initialValues,
      });
    } else {
      setValues(DEFAULT_VALUES);
    }
  }, [initialValues, open]);

  const handleSubmit = async () => {
    await onSubmit({
      ...values,
      img2imgStrength: values.img2imgStrength ?? 0.6,
      imageUrl: values.imageUrl?.trim() ? values.imageUrl.trim() : undefined,
      description: values.description?.trim() ? values.description.trim() : undefined,
      usageNotes: values.usageNotes?.trim() ? values.usageNotes.trim() : undefined,
    });
  };

  const strengthLabel = useMemo(() => {
    const strength = values.img2imgStrength ?? 0.6;
    if (strength >= 0.75) return "High influence";
    if (strength <= 0.45) return "Subtle influence";
    return "Balanced";
  }, [values.img2imgStrength]);

  const disableSave = !values.name.trim() || !values.assetType;
  const submitting = Boolean(isSubmitting);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl bg-[#111] border border-white/10 text-white">
        <DialogHeader>
          <DialogTitle>{mode === "edit" ? "Edit asset" : "Add brand asset"}</DialogTitle>
          <DialogDescription className="text-gray-400">
            Provide a quick reference for the AI so it can stay on-brand across every shot.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-gray-300">Asset type</Label>
              <Select
                value={values.assetType}
                onValueChange={(value: ProjectAssetType) =>
                  setValues((prev) => ({ ...prev, assetType: value }))
                }
              >
                <SelectTrigger className="mt-1 bg-[#1b1b1b] border-white/10 text-white">
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] text-white border-white/10">
                  {assetTypeOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-gray-300">Prominence</Label>
              <Select
                value={values.prominence ?? "primary"}
                onValueChange={(value: AssetProminence) =>
                  setValues((prev) => ({ ...prev, prominence: value }))
                }
              >
                <SelectTrigger className="mt-1 bg-[#1b1b1b] border-white/10 text-white">
                  <SelectValue placeholder="Select prominence" />
                </SelectTrigger>
                <SelectContent className="bg-[#0f0f0f] text-white border-white/10">
                  {prominenceOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div>
            <Label className="text-gray-300">Asset name</Label>
            <Input
              value={values.name}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, name: event.target.value }))
              }
              placeholder="Red Bull logo"
              className="mt-1 bg-[#1b1b1b] border-white/10 text-white"
            />
          </div>

          <div>
            <Label className="text-gray-300">Reference image URL</Label>
            <Input
              value={values.imageUrl ?? ""}
              onChange={(event) =>
                setValues((prev) => ({ ...prev, imageUrl: event.target.value }))
              }
              placeholder="https://..."
              className="mt-1 bg-[#1b1b1b] border-white/10 text-white"
            />
            <p className="text-xs text-gray-500 mt-1">
              Paste a hosted image (PNG/JPG/WebP). Upload support is coming soon.
            </p>

            <div className="mt-3 h-40 rounded-2xl border border-dashed border-white/10 bg-black/30 flex items-center justify-center overflow-hidden">
              {values.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={values.imageUrl}
                  alt={values.name || "Asset preview"}
                  className="h-full w-full object-cover"
                  onError={() =>
                    setValues((prev) => ({
                      ...prev,
                      imageUrl: undefined,
                    }))
                  }
                />
              ) : (
                <div className="flex flex-col items-center text-gray-500 text-sm gap-2">
                  <ImageIcon className="w-6 h-6" />
                  <span>No preview yet</span>
                </div>
              )}
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div>
              <Label className="text-gray-300">What is this?</Label>
              <Textarea
                value={values.description ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, description: event.target.value }))
                }
                placeholder="Describe the product, logo, or character..."
                className="mt-1 bg-[#1b1b1b] border-white/10 text-white"
                rows={4}
              />
            </div>
            <div>
              <Label className="text-gray-300">How should it be used?</Label>
              <Textarea
                value={values.usageNotes ?? ""}
                onChange={(event) =>
                  setValues((prev) => ({ ...prev, usageNotes: event.target.value }))
                }
                placeholder={'e.g., "Top-right watermark", "Hero product centered in frame"'}
                className="mt-1 bg-[#1b1b1b] border-white/10 text-white"
                rows={4}
              />
            </div>
          </div>

          <div>
            <Label className="text-gray-300 flex items-center justify-between">
              <span>Img2Img influence</span>
              <span className="text-xs text-gray-500">
                {Math.round((values.img2imgStrength ?? 0.6) * 100)}% · {strengthLabel}
              </span>
            </Label>
            <Slider
              value={[values.img2imgStrength ?? 0.6]}
              onValueChange={([value]) =>
                setValues((prev) => ({ ...prev, img2imgStrength: value }))
              }
              min={0.3}
              max={0.9}
              step={0.05}
              className="mt-3"
            />
          </div>
        </div>

        <DialogFooter className="mt-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            className="border-white/20 text-gray-300"
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={disableSave || submitting}
            className={cn(
              "bg-white text-black hover:bg-gray-200",
              submitting && "opacity-70 cursor-not-allowed",
            )}
          >
            {submitting ? "Saving..." : mode === "edit" ? "Save changes" : "Add asset"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
