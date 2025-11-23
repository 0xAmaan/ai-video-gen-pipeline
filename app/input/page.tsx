"use client";

import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Check, Plus, Trash2, Upload, X } from "lucide-react";
import { VoiceDictationButton } from "@/components/ui/voice-dictation-button";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import {
  useCreateProjectAsset,
  useCreateRedesignProject,
} from "@/lib/hooks/useProjectRedesign";
import { toast } from "sonner";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DraftAsset = {
  id: string;
  imageUrl: string;
  name: string;
  assetType: "logo";
};

type BrandFolder = {
  id: string;
  name: string;
  createdAt: number;
  assets: DraftAsset[];
};

const FOLDER_STORAGE_KEY = "brand-asset-folders-v1";
const DEFAULT_FOLDER_NAME = "Untitled folder";

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
  const [folders, setFolders] = useState<BrandFolder[]>([]);
  const [selectedAssetIds, setSelectedAssetIds] = useState<string[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [folderModalOpen, setFolderModalOpen] = useState(false);
  const [folderSelectionDraft, setFolderSelectionDraft] = useState<string[]>([]);
  const [folderNameInput, setFolderNameInput] = useState(DEFAULT_FOLDER_NAME);
  const [isUploadingToFolder, setIsUploadingToFolder] = useState(false);
  const [folderDeleteConfirmId, setFolderDeleteConfirmId] = useState<string | null>(null);
  const [isModalDragging, setIsModalDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const modalDragCounter = useRef(0);
  const storageWarningShownRef = useRef(false);
  const router = useRouter();
  const { userId, isSignedIn } = useAuth();
  const createProject = useCreateRedesignProject();
  const createAsset = useCreateProjectAsset();
  const generateUploadUrl = useMutation(api.projectAssets.generateUploadUrl);

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const stored = window.localStorage.getItem(FOLDER_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          const normalized = parsed.map((folder: BrandFolder) => ({
            ...folder,
            name: folder.name || DEFAULT_FOLDER_NAME,
            assets: Array.isArray(folder.assets)
              ? folder.assets.map((asset: DraftAsset, index: number) => ({
                  id: asset.id || createDraftId(),
                  imageUrl: asset.imageUrl,
                  name: asset.name || `Brand asset ${index + 1}`,
                  assetType: "logo" as const,
                }))
              : [],
          }));
          setFolders(normalized);
        }
      }
    } catch (error) {
      console.error("Failed to load saved brand folders:", error);
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const payload = JSON.stringify(folders);
      const approxBytes = payload.length; // ~1 char = 1 byte in UTF-8 for our ASCII payload
      const LIMIT_BYTES = 2.5 * 1024 * 1024; // ~2.5MB cap to avoid quota errors
      if (approxBytes > LIMIT_BYTES) {
        if (!storageWarningShownRef.current) {
          toast.warning("Brand folders not saved locally: too many images for browser storage.");
          storageWarningShownRef.current = true;
        }
        return;
      }
      window.localStorage.setItem(FOLDER_STORAGE_KEY, payload);
    } catch (error) {
      if (!storageWarningShownRef.current) {
        toast.warning("Could not save brand folders locally (storage limit).");
        storageWarningShownRef.current = true;
      }
      console.error("Failed to persist brand folders:", error);
    }
  }, [folders]);

  const assetLookup = useMemo(() => {
    const map = new Map<string, { asset: DraftAsset; folderId: string }>();
    folders.forEach((folder) => {
      folder.assets.forEach((asset) => {
        map.set(asset.id, { asset, folderId: folder.id });
      });
    });
    return map;
  }, [folders]);

  useEffect(() => {
    setSelectedAssetIds((prev) => prev.filter((id) => assetLookup.has(id)));
  }, [assetLookup]);

  const selectedAssets = useMemo(
    () =>
      selectedAssetIds
        .map((id) => assetLookup.get(id)?.asset)
        .filter((asset): asset is DraftAsset => Boolean(asset)),
    [assetLookup, selectedAssetIds],
  );

  const activeFolderAssets = useMemo(
    () =>
      activeFolderId
        ? folders.find((folder) => folder.id === activeFolderId)?.assets ?? []
        : [],
    [activeFolderId, folders],
  );

  const handleOpenFolder = (folderId: string) => {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    setActiveFolderId(folderId);
    setFolderNameInput(folder.name || DEFAULT_FOLDER_NAME);
    const existingSelection = selectedAssetIds.filter((id) =>
      folder.assets.some((asset) => asset.id === id),
    );
    setFolderSelectionDraft(existingSelection);
    setFolderModalOpen(true);
  };

  const handleCreateFolder = () => {
    const newFolder: BrandFolder = {
      id: createDraftId(),
      name: DEFAULT_FOLDER_NAME,
      createdAt: Date.now(),
      assets: [],
    };
    setFolders((prev) => [newFolder, ...prev]);
    setActiveFolderId(newFolder.id);
    setFolderNameInput(newFolder.name);
    setFolderSelectionDraft([]);
    setFolderModalOpen(true);
  };

  const handleFilesForFolder = useCallback(
    (folderId: string, fileList: FileList | null) => {
      if (!folderId) return;
      if (!fileList?.length) return;
      const imageFiles = Array.from(fileList).filter((file) =>
        file.type.startsWith("image/"),
      );
      if (imageFiles.length === 0) return;

      setIsUploadingToFolder(true);
      imageFiles.forEach((file, index) => {
        const reader = new FileReader();
        reader.onload = () => {
          if (typeof reader.result !== "string") return;
          const nextAsset: DraftAsset = {
            id: createDraftId(),
            imageUrl: reader.result,
            name: file.name?.split(".")[0] || `Brand asset ${index + 1}`,
            assetType: "logo",
          };
          setFolders((prev) =>
            prev.map((folder) =>
              folder.id === folderId
                ? { ...folder, assets: [nextAsset, ...folder.assets] }
                : folder,
            ),
          );
          setFolderSelectionDraft((prev) => {
            if (!folderModalOpen || activeFolderId !== folderId) return prev;
            return [...prev, nextAsset.id];
          });
        };
        reader.readAsDataURL(file);
      });
      setIsUploadingToFolder(false);
    },
    [activeFolderId, folderModalOpen],
  );

  const handleModalFileInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!activeFolderId) return;
    handleFilesForFolder(activeFolderId, event.target.files);
    event.target.value = "";
  };

  const handleToggleSelectionInFolder = (assetId: string) => {
    setFolderSelectionDraft((prev) =>
      prev.includes(assetId)
        ? prev.filter((id) => id !== assetId)
        : [...prev, assetId],
    );
  };

  const handleRemoveAssetFromFolder = (assetId: string) => {
    if (!activeFolderId) return;
    setFolders((prev) =>
      prev.map((folder) =>
        folder.id === activeFolderId
          ? { ...folder, assets: folder.assets.filter((asset) => asset.id !== assetId) }
          : folder,
      ),
    );
    setFolderSelectionDraft((prev) => prev.filter((id) => id !== assetId));
    setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId));
  };

  const handleConfirmFolder = () => {
    if (!activeFolderId) return;

    const activeFolder = folders.find((f) => f.id === activeFolderId);
    const folderAssetIds = new Set(activeFolder?.assets.map((asset) => asset.id) ?? []);
    setSelectedAssetIds((prev) => {
      const preserved = prev.filter((id) => !folderAssetIds.has(id));
      const combined = [...preserved, ...folderSelectionDraft];
      if (combined.length > MAX_ASSETS) {
        toast.info(`You can only use up to ${MAX_ASSETS} brand images per project.`);
      }
      return combined.slice(0, MAX_ASSETS);
    });
    setFolderModalOpen(false);
    setActiveFolderId(null);
    setFolderSelectionDraft([]);
    setFolderNameInput(DEFAULT_FOLDER_NAME);
  };

  const handleFolderNameChange = (value: string) => {
    if (!activeFolderId) return;
    setFolderNameInput(value);
    setFolders((prev) =>
      prev.map((folder) =>
        folder.id === activeFolderId
          ? { ...folder, name: value.trim() || DEFAULT_FOLDER_NAME }
          : folder,
      ),
    );
  };

  const handleRemoveSelectedAsset = (assetId: string) => {
    setSelectedAssetIds((prev) => prev.filter((id) => id !== assetId));
  };

  const handleDeleteFolder = (folderId: string) => {
    if (folderDeleteConfirmId === folderId) {
      setFolders((prev) => prev.filter((folder) => folder.id !== folderId));
      setSelectedAssetIds((prev) =>
        prev.filter((id) => {
          const found = folders.find((folder) => folder.id === folderId);
          const ids = new Set(found?.assets.map((asset) => asset.id));
          return !ids.has(id);
        }),
      );
      if (activeFolderId === folderId) {
        setActiveFolderId(null);
        setFolderModalOpen(false);
        setFolderSelectionDraft([]);
        setFolderNameInput(DEFAULT_FOLDER_NAME);
      }
      setFolderDeleteConfirmId(null);
      return;
    }

    setFolderDeleteConfirmId(folderId);
    setTimeout(() => {
      setFolderDeleteConfirmId((current) => (current === folderId ? null : current));
    }, 2000);
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

      if (selectedAssets.length) {
        await Promise.all(
          selectedAssets.map(async (asset) => {
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

      setSelectedAssetIds([]);

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

          {/* Brand asset folders */}
          <div className="mt-6 bg-white/[0.03] border border-white/10 rounded-2xl p-5 relative">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm text-gray-500">Brand Assets</p>
                <p className="text-xs text-gray-500">
                  Save brand folders once, reuse them across projects, and pick images from
                  multiple folders for this campaign.
                </p>
              </div>
            </div>

            <div className="mt-4 flex items-center gap-3 overflow-x-auto pb-2 folder-scroll">
              <button
                type="button"
                onClick={handleCreateFolder}
                title="Create folder"
                className="flex h-16 min-w-[170px] items-center justify-center gap-2 rounded-full border border-dashed border-white/25 bg-white/[0.02] px-4 text-sm text-white hover:border-white/50 hover:bg-white/[0.05] transition"
              >
                <div className="flex h-9 w-9 items-center justify-center rounded-full border border-white/25 bg-white/[0.04]">
                  <Plus className="h-4 w-4" />
                </div>
                <div className="text-left">
                  <p className="font-semibold">New folder</p>
                </div>
              </button>

              {folders.map((folder) => {
                const preview = folder.assets[0];
                return (
                  <button
                    key={folder.id}
                    type="button"
                    onClick={() => handleOpenFolder(folder.id)}
                    className="group flex h-16 min-w-[180px] items-center gap-3 rounded-full border border-white/15 bg-white/[0.04] px-3 text-left text-white hover:border-white/40 hover:bg-white/[0.08] transition"
                    aria-label={`Open folder ${folder.name}`}
                  >
                    <div className="relative h-12 w-12 overflow-hidden rounded-full border border-white/10 bg-black/40 flex items-center justify-center">
                      {preview ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={preview.imageUrl}
                          alt={folder.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-[11px] text-gray-500">Empty</span>
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold leading-tight line-clamp-1">
                        {folder.name || DEFAULT_FOLDER_NAME}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="mt-5 rounded-2xl border border-dashed border-white/12 bg-black/30 p-4">
              {selectedAssets.length === 0 ? (
                <div className="text-sm text-gray-500">
                  Pick images inside a folder to attach them to this project. You can mix
                  assets from different folders (up to {MAX_ASSETS} total).
                </div>
              ) : (
                <div className="flex flex-wrap gap-3">
                  {selectedAssets.map((asset) => (
                    <div
                      key={asset.id}
                      className="relative group h-20 w-20 overflow-hidden rounded-2xl border border-white/10 bg-black/40"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={asset.imageUrl}
                        alt={asset.name}
                        className="h-full w-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveSelectedAsset(asset.id)}
                        className="absolute top-1 right-1 rounded-full bg-black/70 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                        aria-label="Remove selected brand asset"
                      >
                        <X className="h-4 w-4 text-gray-300" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <Dialog
            open={folderModalOpen}
            onOpenChange={(open) => {
              setFolderModalOpen(open);
              if (!open) {
                setActiveFolderId(null);
                setFolderSelectionDraft([]);
                setFolderNameInput(DEFAULT_FOLDER_NAME);
              }
            }}
          >
          <DialogContent
            className="w-full max-w-5xl bg-[#0e0e0e] border border-white/10 text-white"
            onDragEnter={(event) => {
              if (!activeFolderId) return;
              event.preventDefault();
              modalDragCounter.current += 1;
              setIsModalDragging(true);
            }}
            onDragOver={(event) => {
              if (!activeFolderId) return;
              event.preventDefault();
              event.dataTransfer.dropEffect = "copy";
              setIsModalDragging(true);
            }}
            onDragLeave={(event) => {
              if (!activeFolderId) return;
              event.preventDefault();
              modalDragCounter.current = Math.max(0, modalDragCounter.current - 1);
              if (modalDragCounter.current === 0) {
                setIsModalDragging(false);
              }
            }}
            onDrop={(event) => {
              if (!activeFolderId) return;
              event.preventDefault();
              modalDragCounter.current = 0;
              setIsModalDragging(false);
              handleFilesForFolder(activeFolderId, event.dataTransfer.files);
            }}
          >
            <DialogHeader className="gap-1">
              <div className="flex items-start gap-3">
                <div className="flex-1">
                  <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                    Brand folder
                  </p>
                  <DialogTitle>
                    <input
                      value={folderNameInput}
                      onChange={(event) => handleFolderNameChange(event.target.value)}
                      className="w-full rounded-xl bg-white/[0.06] px-3 py-2 text-base font-semibold text-white border border-white/10 focus:outline-none focus:ring-2 focus:ring-white/30"
                      placeholder={DEFAULT_FOLDER_NAME}
                    />
                  </DialogTitle>
                </div>
              </div>
              <p className="text-sm text-gray-400">
                Drag brand images in, or upload, then select which to use for this project.
              </p>
            </DialogHeader>

              <div className="space-y-4">
                <div
                  className="rounded-2xl border border-dashed border-white/15 bg-white/[0.03] p-4 flex flex-wrap items-center justify-between gap-3"
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={(event) => {
                    event.preventDefault();
                    if (!activeFolderId) return;
                    handleFilesForFolder(activeFolderId, event.dataTransfer.files);
                  }}
                >
                  <div>
                    <p className="text-sm text-gray-200">Add images</p>
                    <p className="text-xs text-gray-500">
                      Drag and drop or click upload.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!activeFolderId || isUploadingToFolder}
                      onClick={() => fileInputRef.current?.click()}
                      className="border-white/30 text-white hover:bg-white/10"
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      Upload
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      className="hidden"
                      onChange={handleModalFileInputChange}
                    />
                  </div>
                </div>

                {activeFolderId ? (
                  <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3">
                    {activeFolderAssets.map((asset) => (
                      <div
                        key={asset.id}
                        className={cn(
                          "group relative h-28 w-full overflow-hidden rounded-2xl border border-white/12 bg-black/40 transition",
                          folderSelectionDraft.includes(asset.id)
                            ? "ring-2 ring-white/80 ring-offset-[3px] ring-offset-[#0e0e0e] border-transparent"
                            : "hover:border-white/40",
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => handleToggleSelectionInFolder(asset.id)}
                          className="absolute inset-0"
                          aria-pressed={folderSelectionDraft.includes(asset.id)}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={asset.imageUrl}
                            alt={asset.name}
                            className="h-full w-full object-cover"
                          />
                          <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-black/0" />
                          {folderSelectionDraft.includes(asset.id) && (
                            <div className="absolute inset-0 flex items-center justify-center">
                              <div className="h-10 w-10 rounded-full bg-black/70 flex items-center justify-center">
                                <Check className="h-5 w-5 text-white" />
                              </div>
                            </div>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveAssetFromFolder(asset.id)}
                          className="absolute top-1.5 right-1.5 rounded-full bg-black/70 p-1 opacity-0 transition-opacity group-hover:opacity-100 hover:bg-black/80"
                          aria-label="Remove asset from folder"
                        >
                          <Trash2 className="h-4 w-4 text-gray-200" />
                        </button>
                      </div>
                    ))}
                    {activeFolderAssets.length === 0 && (
                      <div className="col-span-full rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-6 text-center text-sm text-gray-500">
                        Folder images will appear here.
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-white/12 bg-white/[0.02] p-6 text-center text-sm text-gray-500">
                    Create or open a folder to add assets.
                  </div>
                )}
              </div>

              <DialogFooter className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  {activeFolderId && (
                    <Button
                      type="button"
                      variant={folderDeleteConfirmId === activeFolderId ? "destructive" : "outline"}
                      className={cn(
                        folderDeleteConfirmId === activeFolderId
                          ? "border-red-400/70 bg-red-500/10 text-red-50"
                          : "border-white/20 text-gray-300",
                      )}
                      onClick={() => handleDeleteFolder(activeFolderId)}
                    >
                      {folderDeleteConfirmId === activeFolderId ? "Confirm delete" : "Delete"}
                    </Button>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    className="border-white/20 text-gray-300"
                    onClick={() => {
                      setFolderModalOpen(false);
                      setActiveFolderId(null);
                      setFolderSelectionDraft([]);
                    }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="button"
                    onClick={handleConfirmFolder}
                    disabled={!activeFolderId}
                    className="bg-white text-black hover:bg-gray-200"
                  >
                    Use selected
                  </Button>
                </div>
              </DialogFooter>
            {isModalDragging && (
              <div className="pointer-events-none absolute inset-0 rounded-2xl border-2 border-dashed border-blue-400/70 bg-blue-500/10 flex items-center justify-center text-sm text-blue-100">
                Drop images to add to this folder
              </div>
            )}
          </DialogContent>
        </Dialog>

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
      <style jsx global>{`
        .folder-scroll::-webkit-scrollbar {
          height: 8px;
        }
        .folder-scroll::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.08);
          border-radius: 9999px;
        }
        .folder-scroll::-webkit-scrollbar-track {
          background: transparent;
        }
      `}</style>
    </div>
  );
};

export default RawInputPage;
