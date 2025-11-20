"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@clerk/nextjs";
import { Pencil, Trash2, Upload } from "lucide-react";
import { VoiceDictationButton } from "@/components/ui/voice-dictation-button";
import { useVoiceDictation } from "@/hooks/useVoiceDictation";
import {
  useCreateProjectAsset,
  useCreateRedesignProject,
} from "@/lib/hooks/useProjectRedesign";
import { toast } from "sonner";
import { AssetFormDialog, AssetFormValues } from "@/components/redesign/AssetFormDialog";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

type DraftAsset = AssetFormValues & { id: string };

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
  const [assetDialogOpen, setAssetDialogOpen] = useState(false);
  const [editingDraft, setEditingDraft] = useState<DraftAsset | null>(null);
  const router = useRouter();
  const { userId, isSignedIn } = useAuth();
  const createProject = useCreateRedesignProject();
  const createAsset = useCreateProjectAsset();

  // Voice dictation
  const {
    isListening,
    isSupported,
    transcript,
    toggleListening,
    resetTranscript,
  } = useVoiceDictation();

  // Update input with voice transcript
  useEffect(() => {
    if (transcript) {
      setInput(transcript);
    }
  }, [transcript]);

  // Reset transcript when input is manually cleared
  useEffect(() => {
    if (!input && transcript) {
      resetTranscript();
    }
  }, [input, transcript, resetTranscript]);

  const handleOpenAssetDialog = () => {
    setEditingDraft(null);
    setAssetDialogOpen(true);
  };

  const handleSaveDraft = async (values: AssetFormValues) => {
    if (editingDraft) {
      setAssetDrafts((prev) =>
        prev.map((draft) =>
          draft.id === editingDraft.id
            ? {
                ...draft,
                ...values,
              }
            : draft,
        ),
      );
    } else {
      setAssetDrafts((prev) => [...prev, { id: createDraftId(), ...values }]);
    }

    setEditingDraft(null);
    setAssetDialogOpen(false);
  };

  const handleEditDraft = (draft: DraftAsset) => {
    setEditingDraft(draft);
    setAssetDialogOpen(true);
  };

  const handleRemoveDraft = (draftId: string) => {
    setAssetDrafts((prev) => prev.filter((draft) => draft.id !== draftId));
  };

  const handleSubmit = async () => {
    if (!input.trim()) {
      toast.error("Please enter a description of your commercial");
      return;
    }

    if (!userId) {
      toast.error("You must be signed in to create a project");
      return;
    }

    setIsCreating(true);
    try {
      // Create project with user input
      const projectId = await createProject({
        userId,
        title: input.trim().slice(0, 50) + (input.trim().length > 50 ? "..." : ""), // Use first 50 chars as title
        prompt: input.trim(),
        promptPlannerData: input.trim(),
      });

      if (assetDrafts.length) {
        await Promise.all(
          assetDrafts.map((asset) =>
            createAsset({
              projectId,
              assetType: asset.assetType,
              name: asset.name,
              description: asset.description,
              usageNotes: asset.usageNotes,
              prominence: asset.prominence,
              img2imgStrength: asset.img2imgStrength,
              imageUrl: asset.imageUrl,
            }),
          ),
        );
      }

      toast.success("Project created!");
      if (assetDrafts.length) {
        toast.success(`Saved ${assetDrafts.length} brand asset${assetDrafts.length > 1 ? "s" : ""}`);
      }
      setAssetDrafts([]);

      // Navigate to loading screen
      router.push(`/project-redesign/${projectId}/loading`);

      // Trigger AI scene generation in the background
      fetch("/api/project-redesign/generate-scenes", {
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
      toast.error("Failed to create project. Please try again.");
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
            what commercial do you envision?
          </label>

          {/* Text Input with Voice Button */}
          <div className="relative mb-6">
            <textarea
              id="commercial-input"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe your commercial idea..."
              className="w-full min-h-[140px] px-5 py-4 pr-16 bg-white/[0.05] border border-white/10 rounded-xl text-white placeholder:text-gray-500 text-base resize-none transition-colors focus:outline-none focus:border-white/20 focus:bg-white/[0.08] disabled:opacity-50 disabled:cursor-not-allowed"
              autoFocus
              disabled={isListening || isCreating}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey) && input.trim()) {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
            />
            <div className="absolute top-4 right-4">
              <VoiceDictationButton
                isListening={isListening}
                isSupported={isSupported}
                onToggle={toggleListening}
                size="default"
              />
            </div>
          </div>

          {/* Voice to Text Label (when not listening) */}
          {!isListening && (
            <p className="text-sm text-gray-500 text-center mb-6">
              voice to text
            </p>
          )}

          {/* Listening Indicator */}
          {isListening && (
            <p className="text-sm text-red-400 text-center mb-6 font-medium">
              🔴 Recording... Click the mic to stop
            </p>
          )}

          {/* Asset Drafts */}
          <div className="mt-6 bg-white/[0.03] border border-white/10 rounded-2xl p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm uppercase tracking-[0.35em] text-gray-500">
                  Brand assets
                </p>
                <p className="text-xs text-gray-500">
                  Upload logos, hero products, or characters you want in every shot.
                </p>
              </div>
              <button
                onClick={handleOpenAssetDialog}
                disabled={isCreating}
                className="flex items-center gap-2 rounded-xl border border-white/20 px-4 py-2 text-sm text-white hover:bg-white/10 disabled:opacity-50"
              >
                <Upload className="w-4 h-4" />
                Add asset
              </button>
            </div>

            {assetDrafts.length === 0 ? (
              <p className="text-sm text-gray-500 mt-4">
                No assets yet. Add your logo, hero product, or any references you want the AI
                to weave into the story.
              </p>
            ) : (
              <div className="mt-4 space-y-3">
                {assetDrafts.map((draft) => (
                  <Card
                    key={draft.id}
                    className="bg-[#101010] border-white/10 p-4 flex items-start gap-4"
                  >
                    {draft.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={draft.imageUrl}
                        alt={draft.name}
                        className="w-16 h-16 rounded-xl object-cover border border-white/10"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-xl border border-dashed border-white/10 flex items-center justify-center text-[10px] text-gray-500">
                        No image
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-white line-clamp-1">
                          {draft.name || "Unnamed asset"}
                        </p>
                        <Badge className="text-[10px] uppercase tracking-wide">
                          {draft.assetType}
                        </Badge>
                        {draft.prominence && (
                          <Badge
                            className="text-[10px] uppercase tracking-wide bg-emerald-500/20 text-emerald-200"
                          >
                            {draft.prominence}
                          </Badge>
                        )}
                      </div>
                      {draft.description && (
                        <p className="text-xs text-gray-400 mt-1 line-clamp-2">
                          {draft.description}
                        </p>
                      )}
                      {draft.usageNotes && (
                        <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">
                          Usage: {draft.usageNotes}
                        </p>
                      )}
                      <div className="flex gap-2 mt-3">
                        <button
                          onClick={() => handleEditDraft(draft)}
                          className="flex items-center gap-1 text-xs text-gray-300 hover:text-white"
                        >
                          <Pencil className="w-4 h-4" />
                          Edit
                        </button>
                        <button
                          onClick={() => handleRemoveDraft(draft.id)}
                          className="flex items-center gap-1 text-xs text-red-300 hover:text-red-200"
                        >
                          <Trash2 className="w-4 h-4" />
                          Remove
                        </button>
                      </div>
                    </div>
                  </Card>
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
      <AssetFormDialog
        open={assetDialogOpen}
        onOpenChange={(open) => {
          setAssetDialogOpen(open);
          if (!open) {
            setEditingDraft(null);
          }
        }}
        mode={editingDraft ? "edit" : "create"}
        initialValues={
          editingDraft
            ? {
                assetType: editingDraft.assetType,
                name: editingDraft.name,
                description: editingDraft.description,
                usageNotes: editingDraft.usageNotes,
                prominence: editingDraft.prominence,
                img2imgStrength: editingDraft.img2imgStrength,
                imageUrl: editingDraft.imageUrl,
              }
            : undefined
        }
        onSubmit={handleSaveDraft}
      />
    </div>
  );
};

export default RawInputPage;
