"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Trash2, Upload } from "lucide-react";
import { VoiceDictationButton } from "@/components/ui/voice-dictation-button";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import {
  useCreateProjectAsset,
  useCreateRedesignProject,
} from "@/lib/hooks/useProjectRedesign";
import {
  useBrandAssets,
  useImportBrandAssets,
} from "@/lib/hooks/useBrandAssets";
import type { BrandAssetDoc } from "@/lib/hooks/useBrandAssets";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import type { ProjectAssetType } from "@/lib/types/redesign";

type DraftAsset = {
  id: string;
  imageUrl: string;
  name: string;
  assetType: ProjectAssetType;
  brandAssetId?: Id<"brandAssets">;
};

const MAX_ASSETS = 20;

const createDraftId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2);
};

const RawInputPage = () => {
  const [input, setInput] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [assetDrafts, setAssetDrafts] = useState<DraftAsset[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragCounter = useRef(0);
  const router = useRouter();
  const { userId, isSignedIn } = useAuth();
  const createProject = useCreateRedesignProject();
  const createAsset = useCreateProjectAsset();
  const generateUploadUrl = useMutation(api.projectAssets.generateUploadUrl);
  const brandAssets = useBrandAssets(isSignedIn);
  const importBrandAssets = useImportBrandAssets();

  // Voice dictation
  const {
    isListening,
    isSupported,
    transcript,
    toggleListening,
  } = useVoiceDictation({
    existingText: input, // Preserve whatever is already in the textarea
  });

  // Update input with voice transcript only when listening
  useEffect(() => {
    if (isListening && transcript) {
      setInput(transcript);
    }
  }, [transcript, isListening]);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList?.length) return;
      const imageFiles = Array.from(fileList).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) return;

      const availableSlots = Math.max(0, MAX_ASSETS - assetDrafts.length);
      if (availableSlots <= 0) {
        toast.info(`You can only upload up to ${MAX_ASSETS} images for now.`);
        return;
      }

      const filesToAdd = imageFiles.slice(0, availableSlots);
      const skippedCount = imageFiles.length - filesToAdd.length;

      filesToAdd.forEach((file) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== "string") return;
          const imageUrl = reader.result;
          setAssetDrafts((prev) => {
            if (prev.length >= MAX_ASSETS) return prev;
              return [
                ...prev,
                {
                  id: createDraftId(),
                  imageUrl,
                  name: `Brand asset ${prev.length + 1}`,
                  assetType: "logo" as ProjectAssetType,
                },
              ];
            });
        };
        reader.readAsDataURL(file);
      });

      if (skippedCount > 0) {
        toast.info(`You can only upload up to ${MAX_ASSETS} images for now.`);
      }
    },
    [assetDrafts.length],
  );

  const handleAddBrandAsset = (asset: BrandAssetDoc) => {
    if (!asset.imageUrl) {
      toast.error("This asset doesn't have an image yet.");
      return;
    }
    if (assetDrafts.length >= MAX_ASSETS) {
      toast.info(`You can only attach up to ${MAX_ASSETS} assets for now.`);
      return;
    }
    setAssetDrafts((prev) => [
      ...prev,
      {
        id: `${asset._id}-${Date.now()}`,
        imageUrl: asset.imageUrl!,
        name: asset.name,
        assetType: asset.assetType,
        brandAssetId: asset._id,
      },
    ]);
  };

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    handleFiles(event.target.files);
    event.target.value = "";
  };

  const handleDragEnter = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current += 1;
    setIsDragging(true);
  };

  const handleDragOver = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    setIsDragging(true);
  };

  const handleDragLeave = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current = Math.max(0, dragCounter.current - 1);
    if (dragCounter.current <= 0) {
      setIsDragging(false);
    }
  };

  const handleDrop = (event: React.DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    dragCounter.current = 0;
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  const handleRemoveDraft = (draftId: string) => {
    setAssetDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
  };

  const handleSubmit = async () => {
    if (!input.trim()) return;
    if (!userId) return;

    setIsCreating(true);
    try {
      // Create project with user input
      const projectId = await createProject({
        userId,
        title: input.trim().slice(0, 50) + (input.trim().length > 50 ? "..." : ""), // Use first 50 chars as title
        prompt: input.trim(),
        promptPlannerData: input.trim(),
      });

      const customAssetDrafts = assetDrafts.filter(
        (asset) => !asset.brandAssetId,
      );
      const brandAssetIds = Array.from(
        new Set(
          assetDrafts
            .filter((asset) => asset.brandAssetId)
            .map((asset) => asset.brandAssetId as Id<"brandAssets">),
        ),
      );

      if (customAssetDrafts.length) {
        await Promise.all(
          customAssetDrafts.map(async (asset) => {
            let storageId: string | undefined;
            let imageUrl: string | undefined;

            if (asset.imageUrl.startsWith("data:")) {
              try {
                const uploadUrl = await generateUploadUrl();
                const response = await fetch(asset.imageUrl);
                const blob = await response.blob();
                const result = await fetch(uploadUrl, {
                  method: "POST",
                  headers: { "Content-Type": blob.type },
                  body: blob,
                });
                const { storageId: id } = await result.json();
                storageId = id;
              } catch (error) {
                console.error("Failed to upload asset:", error);
                imageUrl = asset.imageUrl.slice(0, 200);
              }
            } else {
              imageUrl = asset.imageUrl;
            }

            return createAsset({
              projectId,
              assetType: asset.assetType,
              name: asset.name,
              storageId,
              imageUrl,
            });
          }),
        );
      }

      if (brandAssetIds.length) {
        await importBrandAssets({
          projectId,
          brandAssetIds,
        });
      }

      setAssetDrafts([]);

      // Navigate to loading screen
      router.push(`/${projectId}/loading`);

      // Trigger AI scene generation in the background
      fetch("/api/generate-scenes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          userInput: input.trim(),
          projectTitle: input.trim().slice(0, 50),
        }),
      }).catch((error) => {
        console.error("Background scene generation failed:", error);
      });
    } catch (error) {
      console.error("Failed to create project:", error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!isSignedIn) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-[#0a0a0a]">
        <p className="text-gray-400">Please sign in to continue</p>
      </div>
    );
  }

  return (
    <div className="h-screen w-full bg-[#0a0a0a] flex items-center justify-center p-8">
      <div className="w-full max-w-2xl">
        {/* Main Input Card */}
        <div className="bg-[#171717] border border-gray-800/60 rounded-3xl p-8 shadow-2xl">
          {/* Question Label */}
          <label
            htmlFor="commercial-input"
            className="block text-xl text-gray-300 mb-6 text-center"
          >
            What commercial do you envision?
          </label>

          {/* Text Input with Voice Button */}
          <div className="relative mb-6">
            <textarea
              id="commercial-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your commercial idea..."
              className="w-full min-h-[140px] px-5 py-4 pb-12 bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder:text-gray-500 text-base resize-none transition-colors focus:outline-none focus:border-white/20 focus:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
              disabled={isListening || isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && input.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="absolute bottom-3 right-3">
              <VoiceDictationButton
                isListening={isListening}
                isSupported={isSupported}
                onToggle={toggleListening}
              />
            </div>
          </div>

          {/* Asset Drafts */}
          <div
            className={`mt-6 bg-white/[0.03] border rounded-2xl p-5 relative transition-colors ${
              isDragging ? "border-blue-400/60 bg-blue-500/5" : "border-white/10"
            }`}
            onDragEnter={handleDragEnter}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">
                  Project assets
                </p>
                <p className="text-xs text-gray-500">
                  Upload references unique to this brief (max {MAX_ASSETS} total).
                </p>
              </div>
              <button
                onClick={handleUploadClick}
                disabled={isCreating}
                className="flex items-center justify-center rounded-xl border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
                aria-label="Upload brand assets"
              >
                <Upload className="w-4 h-4" />
              </button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={handleFileInputChange}
            />

            {isDragging && (
              <div className="pointer-events-none absolute inset-0 flex items-center justify-center rounded-2xl border-2 border-dashed border-blue-400/60 bg-blue-500/10 text-sm text-blue-100">
                Drop images to upload
              </div>
            )}

            {assetDrafts.length === 0 ? (
              <p className="text-sm text-gray-500 mt-4">
                No assets yet. Drag and drop here or click the upload button.
              </p>
            ) : (
              <div className="mt-4 flex items-center gap-4 overflow-x-auto pb-3">
                {assetDrafts.map((draft) => (
                  <div
                    key={draft.id}
                    className="relative group h-20 w-20 flex-shrink-0 overflow-hidden rounded-2xl border border-white/10 bg-black/40"
                  >
                    {draft.brandAssetId && (
                      <span className="absolute left-1.5 top-1.5 z-10 rounded-full bg-emerald-400/80 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-black">
                        Library
                      </span>
                    )}
                    {draft.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={draft.imageUrl}
                        alt={draft.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center text-[10px] text-gray-500">
                        No image
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => handleRemoveDraft(draft.id)}
                      className="absolute top-1 right-1 rounded-full bg-black/60 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                      aria-label="Remove brand asset"
                    >
                      <Trash2 className="h-4 w-4 text-gray-300" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-6 bg-white/[0.03] border rounded-2xl border-white/10 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-[0.35em] text-gray-500">
                  Brand asset library
                </p>
                <p className="text-sm text-gray-400">
                  Tap any saved asset to attach it to this project.
                </p>
              </div>
              <button
                type="button"
                onClick={() => router.push("/assets")}
                className="rounded-xl border border-white/20 px-3 py-2 text-sm text-white hover:bg-white/10"
              >
                Manage library
              </button>
            </div>
            {brandAssets === undefined ? (
              <div className="mt-4 flex items-center gap-2 text-sm text-gray-500">
                <span className="h-2 w-2 animate-pulse rounded-full bg-gray-400" />
                Loading your library...
              </div>
            ) : brandAssets.length === 0 ? (
              <div className="mt-4 rounded-xl border border-dashed border-white/10 bg-black/40 p-4 text-sm text-gray-500">
                No shared assets yet. Use the Assets page to upload logos,
                products, or characters that should be available to every
                project.
              </div>
            ) : (
              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                {brandAssets.map((asset) => (
                  <button
                    type="button"
                    key={asset._id}
                    onClick={() => handleAddBrandAsset(asset)}
                    className="group relative overflow-hidden rounded-2xl border border-white/10 bg-black/40 text-left transition hover:border-white/30"
                  >
                    <div className="relative h-28 w-full bg-black/30">
                      {asset.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={asset.imageUrl}
                          alt={asset.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-xs text-gray-500">
                          No preview
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                      <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between gap-2 text-white">
                        <div>
                          <p className="text-sm font-semibold line-clamp-1">
                            {asset.name}
                          </p>
                          <p className="text-[11px] uppercase tracking-[0.3em] text-gray-300">
                            {asset.folder || "GENERAL"}
                          </p>
                        </div>
                        <div className="rounded-full bg-white/15 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wide">
                          {asset.assetType}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Continue Button */}
          <button
            onClick={handleSubmit}
            disabled={!input.trim() || isCreating}
            className="w-full mt-4 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isCreating ? "Creating project..." : "Continue"}
          </button>

          {/* Keyboard Shortcut Hint */}
          <p className="text-center text-xs text-gray-500 mt-4">
            {isListening ? "Recording in progress..." : "Press ⌘+Enter to continue"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RawInputPage;
