"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import {
  useBrandAssets,
  useCreateBrandAsset,
  useUpdateBrandAsset,
  useDeleteBrandAsset,
  useGenerateBrandAssetUploadUrl,
} from "@/lib/hooks/useBrandAssets";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { FolderOpen, Loader2, Pencil, Plus, Trash2, Upload } from "lucide-react";
import type { BrandAssetDoc } from "@/lib/hooks/useBrandAssets";

type AssetFormState = {
  name: string;
  folder: string;
  assetType: "logo" | "product" | "character" | "background" | "prop" | "reference" | "other";
  description: string;
  usageNotes: string;
  tags: string;
  imageUrl: string;
  prominence: "primary" | "secondary" | "subtle";
};

const DEFAULT_FORM: AssetFormState = {
  name: "",
  folder: "General",
  assetType: "logo",
  description: "",
  usageNotes: "",
  tags: "",
  imageUrl: "",
  prominence: "primary",
};

const folderLabel = (folder?: string | null) =>
  folder && folder.trim().length > 0 ? folder : "Uncategorized";

const folderPalette = ["#6366F1", "#EC4899", "#22D3EE", "#F97316", "#84CC16"];

const AssetsPage = () => {
  const { isSignedIn } = useAuth();
  const router = useRouter();
  const assets = useBrandAssets(isSignedIn) ?? [];
  const createBrandAsset = useCreateBrandAsset();
  const updateBrandAsset = useUpdateBrandAsset();
  const deleteBrandAsset = useDeleteBrandAsset();
  const generateUploadUrl = useGenerateBrandAssetUploadUrl();

  const [selectedFolder, setSelectedFolder] = useState<string>("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [formState, setFormState] = useState<AssetFormState>(DEFAULT_FORM);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingAsset, setEditingAsset] = useState<BrandAssetDoc | null>(null);
  const [assetToDelete, setAssetToDelete] = useState<BrandAssetDoc | null>(null);

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-[#050505] flex items-center justify-center text-gray-400">
        Please sign in to manage assets.
      </div>
    );
  }

  const folders = useMemo(() => {
    const map = new Map<string, BrandAssetDoc[]>();
    for (const asset of assets) {
      const folder = folderLabel(asset.folder);
      if (!map.has(folder)) {
        map.set(folder, []);
      }
      map.get(folder)!.push(asset);
    }
    return Array.from(map.entries())
      .map(([name, values]) => ({ name, count: values.length }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }, [assets]);

  const filteredAssets = useMemo(() => {
    if (selectedFolder === "all") return assets;
    return assets.filter(
      (asset) => folderLabel(asset.folder) === selectedFolder,
    );
  }, [assets, selectedFolder]);

  const openDialogForCreate = () => {
    setEditingAsset(null);
    setFormState(DEFAULT_FORM);
    setPreviewUrl(null);
    setFile(null);
    setDialogOpen(true);
  };

  const openDialogForEdit = (asset: BrandAssetDoc) => {
    setEditingAsset(asset);
    setFormState({
      name: asset.name,
      folder: asset.folder ?? "General",
      assetType: asset.assetType,
      description: asset.description ?? "",
      usageNotes: asset.usageNotes ?? "",
      tags: (asset.tags ?? []).join(", "),
      imageUrl: asset.imageUrl ?? "",
      prominence: asset.prominence ?? "primary",
    });
    setPreviewUrl(asset.imageUrl ?? null);
    setFile(null);
    setDialogOpen(true);
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const nextFile = event.target.files?.[0];
    if (!nextFile) return;
    setFile(nextFile);
    setPreviewUrl(URL.createObjectURL(nextFile));
    setFormState((prev) => ({ ...prev, imageUrl: "" }));
  };

  const uploadFileIfNeeded = async () => {
    if (!file) return { storageId: undefined as string | undefined };
    const uploadUrl = await generateUploadUrl();
    const response = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type },
      body: file,
    });
    if (!response.ok) {
      throw new Error("Failed to upload asset");
    }
    const json = await response.json();
    return { storageId: json.storageId as string };
  };

  const handleSubmit = async () => {
    if (!formState.name.trim()) return;
    setIsSubmitting(true);
    try {
      const { storageId } = await uploadFileIfNeeded();
      const payload = {
        name: formState.name.trim(),
        folder: formState.folder.trim(),
        assetType: formState.assetType,
        description: formState.description.trim() || undefined,
        usageNotes: formState.usageNotes.trim() || undefined,
        prominence: formState.prominence,
        tags: formState.tags
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        imageUrl: formState.imageUrl.trim() || undefined,
        storageId,
      };

      if (editingAsset) {
        await updateBrandAsset({
          assetId: editingAsset._id,
          ...payload,
        });
      } else {
        await createBrandAsset(payload);
      }

      setDialogOpen(false);
      setEditingAsset(null);
      setFormState(DEFAULT_FORM);
      setFile(null);
      setPreviewUrl(null);
    } catch (error) {
      console.error(error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!assetToDelete) return;
    try {
      await deleteBrandAsset({ assetId: assetToDelete._id });
    } finally {
      setAssetToDelete(null);
    }
  };

  return (
    <div className="min-h-screen w-full bg-[#050505] text-white px-6 py-10">
      <div className="mx-auto w-full max-w-6xl space-y-8">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-gray-500">
              Brand Library
            </p>
            <h1 className="mt-2 text-4xl font-semibold">
              Keep every project on-brand
            </h1>
            <p className="mt-2 text-gray-400 max-w-2xl">
              Store logos, product shots, and reference imagery once, then reuse
              them across every project. Folders help organize by client or
              campaign.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              className="border-white/20 text-white hover:bg-white/10"
              onClick={() => router.push("/home")}
            >
              Back to home
            </Button>
            <Button
              onClick={openDialogForCreate}
              className="bg-white text-black hover:bg-gray-200"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add asset
            </Button>
          </div>
        </div>

        <div className="rounded-3xl bg-white/[0.02] border border-white/5 p-6">
          <div className="flex flex-wrap items-center gap-3">
            <button
              className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm transition ${
                selectedFolder === "all"
                  ? "bg-white text-black"
                  : "bg-black/40 text-gray-300 hover:text-white"
              }`}
              onClick={() => setSelectedFolder("all")}
            >
              <FolderOpen className="h-4 w-4" />
              All folders
              <Badge
                variant={selectedFolder === "all" ? "secondary" : "outline"}
                className="ml-1 rounded-full border-white/20"
              >
                {assets.length}
              </Badge>
            </button>
            {folders.map((folder, index) => (
              <button
                key={folder.name}
                onClick={() => setSelectedFolder(folder.name)}
                className={`flex items-center gap-2 rounded-2xl px-4 py-2 text-sm transition ${
                  selectedFolder === folder.name
                    ? "bg-white text-black"
                    : "bg-black/40 text-gray-300 hover:text-white"
                }`}
              >
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{
                    backgroundColor:
                      folderPalette[index % folderPalette.length],
                  }}
                />
                {folder.name}
                <Badge
                  variant={selectedFolder === folder.name ? "secondary" : "outline"}
                  className="ml-1 rounded-full border-white/20"
                >
                  {folder.count}
                </Badge>
              </button>
            ))}
          </div>
        </div>

        {filteredAssets.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-white/10 bg-white/[0.02] p-12 text-center text-gray-400">
            <p className="text-lg font-medium">
              No assets in this folder yet.
            </p>
            <p className="mt-2">
              Upload logos, hero products, or reference imagery to reuse across
              every project.
            </p>
            <Button
              onClick={openDialogForCreate}
              className="mt-6 bg-white text-black hover:bg-gray-200"
            >
              <Plus className="mr-2 h-4 w-4" />
              Add your first asset
            </Button>
          </div>
        ) : (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredAssets.map((asset) => (
              <div
                key={asset._id}
                className="group relative overflow-hidden rounded-3xl border border-white/5 bg-white/[0.02]"
              >
                <div className="relative h-48 w-full bg-black/40">
                  {asset.imageUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={asset.imageUrl}
                      alt={asset.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-500">
                      No preview
                    </div>
                  )}
                  <div className="absolute top-3 right-3 flex gap-2 opacity-0 transition group-hover:opacity-100">
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 rounded-full bg-black/70 text-white"
                      onClick={() => openDialogForEdit(asset)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="secondary"
                      className="h-9 w-9 rounded-full bg-black/70 text-red-300"
                      onClick={() => setAssetToDelete(asset)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 p-5">
                  <div className="flex items-center justify-between gap-2">
                    <div>
                      <p className="text-lg font-semibold">{asset.name}</p>
                      <p className="text-xs uppercase tracking-[0.3em] text-gray-500">
                        {folderLabel(asset.folder)}
                      </p>
                    </div>
                    <Badge variant="secondary" className="capitalize">
                      {asset.assetType}
                    </Badge>
                  </div>
                  {asset.description && (
                    <p className="text-sm text-gray-400 line-clamp-2">
                      {asset.description}
                    </p>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {asset.tags?.length
                      ? asset.tags.map((tag) => (
                          <Badge
                            key={tag}
                            variant="outline"
                            className="border-white/10 text-gray-300"
                          >
                            {tag}
                          </Badge>
                        ))
                      : null}
                    <Badge
                      variant="outline"
                      className="border-white/10 text-gray-300"
                    >
                      {asset.prominence ?? "primary"}
                    </Badge>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-3xl border border-white/10 bg-[#0f0f0f] text-white">
          <DialogHeader>
            <DialogTitle>
              {editingAsset ? "Edit asset" : "Add brand asset"}
            </DialogTitle>
            <DialogDescription className="text-gray-400">
              Upload reference imagery once and reuse it in every project.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5 md:grid-cols-[1.4fr_1fr]">
            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Name</label>
                <Input
                  value={formState.name}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      name: event.target.value,
                    }))
                  }
                  className="mt-1 border-white/10 bg-black/50"
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm text-gray-400">Folder</label>
                  <Input
                    value={formState.folder}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        folder: event.target.value,
                      }))
                    }
                    className="mt-1 border-white/10 bg-black/50"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-400">Type</label>
                  <select
                    value={formState.assetType}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        assetType: event.target.value as AssetFormState["assetType"],
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm"
                  >
                    <option value="logo">Logo</option>
                    <option value="product">Product</option>
                    <option value="character">Character</option>
                    <option value="background">Background</option>
                    <option value="prop">Prop</option>
                    <option value="reference">Reference</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="text-sm text-gray-400">Description</label>
                <Textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      description: event.target.value,
                    }))
                  }
                  className="mt-1 border-white/10 bg-black/50"
                  rows={3}
                />
              </div>
              <div>
                <label className="text-sm text-gray-400">Usage notes</label>
                <Textarea
                  value={formState.usageNotes}
                  onChange={(event) =>
                    setFormState((prev) => ({
                      ...prev,
                      usageNotes: event.target.value,
                    }))
                  }
                  className="mt-1 border-white/10 bg-black/50"
                  rows={2}
                />
              </div>
              <div className="flex gap-4">
                <div className="flex-1">
                  <label className="text-sm text-gray-400">
                    Prominence
                  </label>
                  <select
                    value={formState.prominence}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        prominence: event.target.value as AssetFormState["prominence"],
                      }))
                    }
                    className="mt-1 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm"
                  >
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="subtle">Subtle</option>
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-sm text-gray-400">Tags</label>
                  <Input
                    value={formState.tags}
                    onChange={(event) =>
                      setFormState((prev) => ({
                        ...prev,
                        tags: event.target.value,
                      }))
                    }
                    placeholder="logo, hero product"
                    className="mt-1 border-white/10 bg-black/50"
                  />
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400">Image</label>
                <div className="mt-2 flex flex-col gap-3 rounded-2xl border border-dashed border-white/10 bg-black/40 p-4">
                  <div className="flex items-center gap-3">
                    <Input
                      value={formState.imageUrl}
                      onChange={(event) =>
                        setFormState((prev) => ({
                          ...prev,
                          imageUrl: event.target.value,
                        }))
                      }
                      placeholder="https://example.com/logo.png"
                      className="border-white/10 bg-black/60"
                    />
                    <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-white/20 px-3 py-2 text-sm text-gray-200 hover:bg-white/10">
                      <Upload className="h-4 w-4" />
                      Upload
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleFileChange}
                      />
                    </label>
                  </div>
                  <div className="h-40 overflow-hidden rounded-xl border border-white/10 bg-black/50">
                    {previewUrl || formState.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={previewUrl ?? formState.imageUrl}
                        alt="Asset preview"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-sm text-gray-500">
                        No preview yet
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/20 text-gray-300"
              onClick={() => setDialogOpen(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={isSubmitting || !formState.name.trim()}
              className="bg-white text-black hover:bg-gray-200"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                "Save asset"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(assetToDelete)} onOpenChange={() => setAssetToDelete(null)}>
        <DialogContent className="border border-white/10 bg-[#101010] text-white">
          <DialogHeader>
            <DialogTitle>Delete asset?</DialogTitle>
            <DialogDescription className="text-gray-400">
              This removes the brand asset from your shared library. Existing
              projects that already imported it will keep their copies.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              className="border-white/20 text-gray-300"
              onClick={() => setAssetToDelete(null)}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              className="bg-red-500 text-white hover:bg-red-600"
              onClick={handleDelete}
            >
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AssetsPage;
