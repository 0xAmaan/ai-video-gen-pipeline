"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Trash2, Upload } from "lucide-react";
import { cn } from "@/lib/utils";

type UploadedImage = {
  id: string;
  dataUrl: string;
  selected: boolean;
};

interface BrandAssetUploadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Called when the user confirms their selection.
   * We only return the selected image data URLs so the parent
   * can decide how to turn them into assets.
   */
  onConfirm: (imageDataUrls: string[]) => void;
}

export const BrandAssetUploadDialog = ({
  open,
  onOpenChange,
  onConfirm,
}: BrandAssetUploadDialogProps) => {
  const [images, setImages] = useState<UploadedImage[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const selectedCount = images.filter((img) => img.selected).length;

  // When dialog opens, deselect all previously uploaded images
  useEffect(() => {
    if (open) {
      setImages((prev) =>
        prev.map((image) => ({ ...image, selected: false }))
      );
    }
  }, [open]);

  const handleClose = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
  };

  const handleFiles = useCallback((fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const files = Array.from(fileList).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (files.length === 0) return;

    files.forEach((file) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          setImages((prev) => [
            {
              id:
                (typeof crypto !== "undefined" && "randomUUID" in crypto
                  ? crypto.randomUUID()
                  : Math.random().toString(36).slice(2)),
              dataUrl: result,
              selected: true,
            },
            ...prev,
          ]);
        }
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    // Clear the value so selecting the same file again still triggers onChange
    event.target.value = "";
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    handleFiles(event.dataTransfer.files);
  };

  const handleRemoveImage = (id: string) => {
    setImages((prev) => prev.filter((image) => image.id !== id));
  };

  const toggleSelected = (id: string) => {
    setImages((prev) => {
      const currentSelected = prev.filter((img) => img.selected).length;

      return prev.map((image) => {
        if (image.id !== id) return image;
        if (!image.selected && currentSelected >= 3) {
          return image;
        }
        return { ...image, selected: !image.selected };
      });
    });
  };

  const handleConfirm = () => {
    const selected = images.filter((img) => img.selected).map((img) => img.dataUrl);
    if (selected.length === 0) return;
    onConfirm(selected);
    // Close dialog but keep images in memory so they are available next time
    onOpenChange(false);
  };

  const hasSelected = selectedCount > 0 && selectedCount <= 3;

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl bg-[#111] border border-white/10 text-white">
        <DialogHeader className="mb-2">
          <DialogTitle>Add brand assets</DialogTitle>
          <DialogDescription className="text-gray-400">
            Upload logos, hero products, or characters. Click images to select
            which ones to use.
          </DialogDescription>
        </DialogHeader>

        <div
          className="mt-2 flex items-center gap-3 overflow-x-auto rounded-2xl bg-black/40 p-4 min-h-[180px]"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {/* Upload tile (top-left) */}
          <button
            type="button"
            onClick={handleUploadClick}
            className="flex h-28 w-28 flex-shrink-0 flex-col items-center justify-center rounded-2xl border border-dashed border-white/15 bg-white/[0.03] text-xs text-gray-300 hover:border-white/40 hover:bg-white/[0.06] transition-colors"
          >
            <Upload className="mb-2 h-6 w-6" />
            <span className="font-medium">Upload</span>
            <span className="mt-1 px-3 text-[10px] text-gray-500 text-center">
              Click or drag &amp; drop
            </span>
          </button>

          {/* Uploaded images */}
          {images.map((image) => (
            <div
              key={image.id}
              onClick={() => toggleSelected(image.id)}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  toggleSelected(image.id);
                }
              }}
              className={cn(
                "group relative h-28 w-28 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40 cursor-pointer",
                image.selected
                  ? "ring-2 ring-white/80 border-white"
                  : "hover:border-white/40",
              )}
              role="button"
              tabIndex={0}
              aria-pressed={image.selected}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={image.dataUrl}
                alt="Uploaded asset"
                className="h-full w-full object-cover"
              />
              <button
                type="button"
                onClick={(event) => {
                  event.stopPropagation();
                  handleRemoveImage(image.id);
                }}
                className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                aria-label="Remove uploaded asset"
              >
                <Trash2 className="h-4 w-4 text-gray-300" />
              </button>
            </div>
          ))}
        </div>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        <DialogFooter className="mt-4">
          <Button
            variant="outline"
            onClick={() => handleClose(false)}
            className="border-white/20 text-gray-300"
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={!hasSelected}
            className={cn(
              "bg-white text-black hover:bg-gray-200",
              !hasSelected && "opacity-60 cursor-not-allowed",
            )}
          >
            Use selected images
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
