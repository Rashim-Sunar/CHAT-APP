import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { BiArrowBack, BiX } from "react-icons/bi";
import { IoCameraOutline, IoImageOutline, IoTextOutline } from "react-icons/io5";
import type { StoryCreatePayload, StoryItem } from "../../types";

type ComposerMode = "menu" | "text" | "media";

interface StoryComposerModalProps {
  open: boolean;
  onClose: () => void;
  onPublishText: (payload: StoryCreatePayload) => Promise<StoryItem>;
  onPublishMedia: (
    file: File,
    caption: string,
    privacy: StoryCreatePayload["privacy"],
    onProgress?: (progress: number) => void
  ) => Promise<StoryItem>;
}

const backgroundOptions = [
  { id: "purple-gradient", className: "bg-gradient-to-br from-indigo-700 via-violet-600 to-fuchsia-500" },
  { id: "night-gradient", className: "bg-gradient-to-br from-slate-950 via-slate-800 to-indigo-900" },
  { id: "sunset-gradient", className: "bg-gradient-to-br from-orange-500 via-rose-500 to-pink-600" },
];

const StoryComposerModal = ({ open, onClose, onPublishText, onPublishMedia }: StoryComposerModalProps) => {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const [mode, setMode] = useState<ComposerMode>("menu");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [caption, setCaption] = useState("");
  const [storyText, setStoryText] = useState("Share a moment");
  const [textAlign, setTextAlign] = useState<"left" | "center" | "right">("center");
  const [background, setBackground] = useState(backgroundOptions[0].id);
  const [privacy, setPrivacy] = useState<"everyone" | "close_friends">("everyone");
  const [uploadProgress, setUploadProgress] = useState(0);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedBackground = useMemo(
    () => backgroundOptions.find((option) => option.id === background) || backgroundOptions[0],
    [background]
  );

  useEffect(() => {
    if (!selectedFile) {
      setPreviewUrl(null);
      return;
    }

    const nextUrl = URL.createObjectURL(selectedFile);
    setPreviewUrl(nextUrl);

    return () => URL.revokeObjectURL(nextUrl);
  }, [selectedFile]);

  useEffect(() => {
    if (!open) {
      setMode("menu");
      setSelectedFile(null);
      setPreviewUrl(null);
      setCaption("");
      setStoryText("Share a moment");
      setTextAlign("center");
      setBackground(backgroundOptions[0].id);
      setPrivacy("everyone");
      setUploadProgress(0);
      setPublishing(false);
      setError(null);
    }
  }, [open]);

  if (!open) return null;

  const pickFile = (source: "gallery" | "camera") => {
    const input = source === "camera" ? cameraInputRef.current : fileInputRef.current;
    input?.click();
  };

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setSelectedFile(file);
    setMode("media");
    setError(null);
    event.target.value = "";
  };

  const handlePublish = async () => {
    setError(null);
    setPublishing(true);

    try {
      if (mode === "text") {
        if (!storyText.trim()) {
          throw new Error("Story text cannot be empty");
        }

        await onPublishText({
          type: "text",
          text: storyText.trim(),
          caption: caption.trim(),
          privacy,
          textAlign,
          background,
        });
        onClose();
        return;
      }

      if (!selectedFile) {
        throw new Error("Select an image or video first");
      }

      await onPublishMedia(selectedFile, caption.trim(), privacy, setUploadProgress);
      onClose();
    } catch (publishError: unknown) {
      setError(publishError instanceof Error ? publishError.message : "Failed to publish story");
    } finally {
      setPublishing(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-3 backdrop-blur-sm">
      <div className="flex max-h-[92vh] w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl">
        <input ref={fileInputRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*,video/*"
          capture="environment"
          className="hidden"
          onChange={handleFileChange}
        />

        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <button type="button" onClick={onClose} className="flex items-center gap-2 text-slate-500 hover:text-slate-800">
            <BiArrowBack size={18} />
            <span className="text-sm font-medium">Back</span>
          </button>
          <h2 className="text-base font-semibold text-slate-900">Create Story</h2>
          <button type="button" onClick={onClose} className="text-slate-500 hover:text-slate-800" aria-label="Close">
            <BiX size={22} />
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">
          {mode === "menu" && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => pickFile("camera")}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <IoCameraOutline size={22} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Camera</p>
                  <p className="text-xs text-slate-500">Capture a new photo or video</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => pickFile("gallery")}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <IoImageOutline size={22} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Gallery</p>
                  <p className="text-xs text-slate-500">Choose an image or video</p>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setMode("text")}
                className="flex w-full items-center gap-3 rounded-2xl border border-slate-200 px-4 py-4 text-left transition-colors hover:bg-slate-50"
              >
                <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-indigo-50 text-indigo-600">
                  <IoTextOutline size={22} />
                </span>
                <div>
                  <p className="text-sm font-semibold text-slate-900">Text Story</p>
                  <p className="text-xs text-slate-500">Create a quick status update</p>
                </div>
              </button>
            </div>
          )}

          {mode === "text" && (
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className={`${selectedBackground.className} min-h-[360px] rounded-3xl p-5 text-white shadow-inner`}>
                <textarea
                  value={storyText}
                  onChange={(event) => setStoryText(event.target.value)}
                  className={`h-[250px] w-full resize-none border-none bg-transparent text-2xl font-semibold leading-tight text-white placeholder:text-white/70 focus:outline-none`}
                  placeholder="Share a moment"
                  style={{ textAlign }}
                  maxLength={160}
                />
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">Background</p>
                  <div className="mt-3 flex gap-2">
                    {backgroundOptions.map((option) => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => setBackground(option.id)}
                        className={`h-11 flex-1 rounded-2xl border-2 transition-all ${option.className} ${
                          background === option.id ? "border-slate-900 scale-[1.02]" : "border-transparent"
                        }`}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Alignment</p>
                  <div className="mt-3 grid grid-cols-3 gap-2">
                    {(["left", "center", "right"] as const).map((align) => (
                      <button
                        key={align}
                        type="button"
                        onClick={() => setTextAlign(align)}
                        className={`rounded-xl border px-3 py-2 text-sm font-medium capitalize transition-colors ${
                          textAlign === align
                            ? "border-indigo-500 bg-indigo-50 text-indigo-700"
                            : "border-slate-200 bg-white text-slate-600"
                        }`}
                      >
                        {align}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {mode === "media" && selectedFile && previewUrl && (
            <div className="grid gap-4 lg:grid-cols-[1.05fr_0.95fr]">
              <div className="overflow-hidden rounded-3xl bg-slate-950">
                {selectedFile.type.startsWith("video/") ? (
                  <video src={previewUrl} controls className="h-[420px] w-full object-contain bg-black" />
                ) : (
                  <img src={previewUrl} alt="Story preview" className="h-[420px] w-full object-contain bg-black" />
                )}
              </div>

              <div className="space-y-4 rounded-3xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <label className="text-sm font-semibold text-slate-900" htmlFor="story-caption">
                    Add a caption
                  </label>
                  <textarea
                    id="story-caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    maxLength={140}
                    placeholder="Optional caption"
                    className="mt-2 h-28 w-full rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-indigo-500"
                  />
                </div>

                <div>
                  <p className="text-sm font-semibold text-slate-900">Who can see this story?</p>
                  <div className="mt-3 space-y-2">
                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm">
                      <span className="font-medium text-slate-800">Everyone</span>
                      <input type="radio" checked={privacy === "everyone"} onChange={() => setPrivacy("everyone")} />
                    </label>
                    <label className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm opacity-60">
                      <span className="font-medium text-slate-800">Close Friends</span>
                      <input type="radio" checked={privacy === "close_friends"} disabled onChange={() => undefined} />
                    </label>
                  </div>
                </div>

                {uploadProgress > 0 && (
                  <div className="space-y-1">
                    <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-indigo-600 transition-all" style={{ width: `${uploadProgress}%` }} />
                    </div>
                    <p className="text-xs text-slate-500">Uploading... {uploadProgress}%</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {error && <p className="mt-4 rounded-2xl bg-rose-50 px-4 py-3 text-sm text-rose-700">{error}</p>}
        </div>

        <div className="flex items-center justify-between border-t border-slate-200 px-5 py-4">
          {mode !== "menu" ? (
            <button
              type="button"
              onClick={() => {
                setMode("menu");
                setSelectedFile(null);
              }}
              className="rounded-full border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
            >
              Back
            </button>
          ) : (
            <span />
          )}

          <button
            type="button"
            onClick={() => void handlePublish()}
            disabled={publishing || (mode === "text" ? !storyText.trim() : !selectedFile)}
            className="rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default StoryComposerModal;
