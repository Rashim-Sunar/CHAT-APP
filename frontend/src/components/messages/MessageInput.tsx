import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from "react";
import { BsFillSendFill } from "react-icons/bs";
import { FiImage, FiFileText, FiVideo, FiPlay, FiX, FiAlertCircle, FiCheck, FiCornerUpLeft } from "react-icons/fi";
import useSendMessage from "../../hooks/useSendMessage";
import useConversation from "../../zustand/useConversation";
import { useAuthContext } from "../../context/Auth-Context";
import { validateFileForUpload } from "../../Utils/mediaValidation";
import { getMessageBodyText } from "../../Utils/messageDisplay";
import toast from "react-hot-toast";
import type { UploadJob } from "../../types";

interface CircularProgressProps {
  progress: number;
  size?: number;
  strokeWidth?: number;
}

// Compact ring indicator overlaid directly on a thumbnail while it uploads,
// mirroring the in-place progress pattern chat apps like WhatsApp use.
const CircularProgress = ({ progress, size = 32, strokeWidth = 3 }: CircularProgressProps) => {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (Math.min(Math.max(progress, 0), 100) / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle cx={size / 2} cy={size / 2} r={radius} stroke="rgba(255,255,255,0.3)" strokeWidth={strokeWidth} fill="none" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        stroke="white"
        strokeWidth={strokeWidth}
        fill="none"
        strokeDasharray={circumference}
        strokeDashoffset={offset}
        strokeLinecap="round"
        className="transition-[stroke-dashoffset] duration-300 ease-out"
      />
    </svg>
  );
};

const MessageInput = () => {
  const { loading, sendMessage, sendFiles } = useSendMessage();
  const { authUser } = useAuthContext();
  const uploadQueue = useConversation((state) => state.uploadQueue);
  const selectedConversation = useConversation((state) => state.selectedConversation);
  const replyTarget = useConversation((state) => state.replyTarget);
  const setReplyTarget = useConversation((state) => state.setReplyTarget);
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const currentUserId = authUser?.data?.user?._id;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!message.trim() && selectedFiles.length === 0) return;

    const replyTo = replyTarget?._id;

    if (message.trim()) {
      await sendMessage(message, replyTo);
      setMessage("");
    }

    if (selectedFiles.length > 0) {
      await sendFiles(selectedFiles, replyTo);
      setSelectedFiles([]);
    }

    setReplyTarget(null);
  };

  const handleFileSelection = (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);

    const acceptedFiles: File[] = [];
    files.forEach((file) => {
      const validation = validateFileForUpload(file);
      if (!validation.valid) {
        toast.error(`${file.name}: ${validation.reason}`);
        return;
      }

      acceptedFiles.push(file);
    });

    if (acceptedFiles.length > 0) {
      setSelectedFiles((current) => [...current, ...acceptedFiles]);
    }

    event.target.value = "";
  };

  const removeSelectedFile = (targetName: string) => {
    setSelectedFiles((current) => current.filter((file) => file.name !== targetName));
  };

  // Local object URLs for instant image/video thumbnails, revoked whenever the
  // selection changes so we don't leak memory while the user is composing.
  const filePreviews = useMemo(
    () =>
      selectedFiles.map((file) => ({
        file,
        url: file.type.startsWith("image/") || file.type.startsWith("video/") ? URL.createObjectURL(file) : null,
      })),
    [selectedFiles]
  );

  useEffect(() => {
    return () => {
      filePreviews.forEach(({ url }) => {
        if (url) URL.revokeObjectURL(url);
      });
    };
  }, [filePreviews]);

  const uploadJobByFileName = useMemo(() => {
    const map = new Map<string, UploadJob>();
    uploadQueue.forEach((job) => map.set(job.fileName, job));
    return map;
  }, [uploadQueue]);

  const replySnippet = replyTarget
    ? replyTarget.deletedForEveryone
      ? "This message was deleted"
      : replyTarget.messageType === "image"
        ? "Photo"
        : replyTarget.messageType === "video"
          ? "Video"
          : replyTarget.messageType === "file"
            ? replyTarget.fileName || "File"
            : getMessageBodyText(replyTarget)
    : "";
  const replySenderName = replyTarget
    ? String(replyTarget.senderId) === String(currentUserId)
      ? "You"
      : selectedConversation?.userName || "them"
    : "";

  return (
    <div className="p-4 space-y-3">
      {replyTarget && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
          <FiCornerUpLeft className="shrink-0 text-indigo-500" size={16} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-indigo-600">Replying to {replySenderName}</p>
            <p className="truncate text-xs text-slate-500">{replySnippet}</p>
          </div>
          <button
            type="button"
            onClick={() => setReplyTarget(null)}
            aria-label="Cancel reply"
            className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-slate-200 hover:text-slate-600"
          >
            <FiX size={14} />
          </button>
        </div>
      )}

      {filePreviews.length > 0 && (
        <div className="flex flex-wrap gap-2.5">
          {filePreviews.map(({ file, url }) => {
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");
            const isMedia = isImage || isVideo;
            const key = `${file.name}-${file.size}-${file.lastModified}`;
            const uploadJob = uploadJobByFileName.get(file.name);
            const isUploading = uploadJob?.status === "uploading";
            const isCompleted = uploadJob?.status === "completed";
            const isFailed = uploadJob?.status === "failed";
            const progress = Math.min(uploadJob?.progress || 0, 100);

            if (isMedia) {
              return (
                <div
                  key={key}
                  className="group relative h-20 w-20 shrink-0 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 shadow-sm"
                >
                  {isImage ? (
                    <img src={url ?? undefined} alt={file.name} className="h-full w-full object-cover" />
                  ) : (
                    <>
                      <video src={url ?? undefined} className="h-full w-full object-cover" muted />
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <FiPlay className="text-white drop-shadow" size={20} />
                      </div>
                    </>
                  )}

                  {!uploadJob && (
                    <>
                      <div className="pointer-events-none absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-black/70 to-transparent px-1.5 pb-1 pt-4 text-[10px] font-medium text-white opacity-0 transition-opacity group-hover:opacity-100">
                        {file.name}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeSelectedFile(file.name)}
                        aria-label={`Remove ${file.name}`}
                        className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-black/60 text-white transition-colors hover:bg-black/80"
                      >
                        <FiX size={12} />
                      </button>
                    </>
                  )}

                  {isUploading && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <CircularProgress progress={progress} />
                    </div>
                  )}

                  {isCompleted && (
                    <div className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-white shadow">
                      <FiCheck size={12} />
                    </div>
                  )}

                  {isFailed && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-rose-900/70">
                      <FiAlertCircle className="text-white" size={16} />
                      <span className="text-[10px] font-semibold text-white">Failed</span>
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={key}
                className="group relative flex max-w-[220px] items-center gap-2 rounded-xl border border-slate-200 bg-white py-2 pl-2.5 pr-8 shadow-sm"
              >
                <div
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                    isFailed ? "bg-rose-50 text-rose-500" : isCompleted ? "bg-emerald-50 text-emerald-600" : "bg-indigo-50 text-indigo-600"
                  }`}
                >
                  {isUploading ? (
                    <CircularProgress progress={progress} size={22} strokeWidth={2.5} />
                  ) : isCompleted ? (
                    <FiCheck size={16} />
                  ) : isFailed ? (
                    <FiAlertCircle size={16} />
                  ) : (
                    <FiFileText size={16} />
                  )}
                </div>
                <p className="min-w-0 flex-1 truncate text-xs font-medium text-slate-700">{file.name}</p>

                {isUploading && <span className="shrink-0 text-[10px] font-semibold text-indigo-600">{progress}%</span>}
                {isFailed && <span className="shrink-0 text-[10px] font-semibold text-rose-500">Failed</span>}

                {!uploadJob && (
                  <button
                    type="button"
                    onClick={() => removeSelectedFile(file.name)}
                    aria-label={`Remove ${file.name}`}
                    className="absolute right-1.5 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 transition-colors hover:bg-rose-50 hover:text-rose-600"
                  >
                    <FiX size={13} />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <form onSubmit={handleSubmit} className="flex items-center gap-3">
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 h-12 px-4 rounded-full border border-slate-300
                    focus:outline-none focus:ring-2 focus:ring-indigo-500
                    transition duration-200"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />

        <label className="cursor-pointer text-slate-600 hover:text-indigo-600">
          <FiImage size={20} />
          <input type="file" className="hidden" accept="image/*" multiple onChange={handleFileSelection} />
        </label>

        <label className="cursor-pointer text-slate-600 hover:text-indigo-600">
          <FiVideo size={20} />
          <input type="file" className="hidden" accept="video/*" multiple onChange={handleFileSelection} />
        </label>

        <label className="cursor-pointer text-slate-600 hover:text-indigo-600">
          <FiFileText size={20} />
          <input
            type="file"
            className="hidden"
            accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
            multiple
            onChange={handleFileSelection}
          />
        </label>

        <button
          type="submit"
          disabled={loading}
          className="w-12 h-12 rounded-full bg-indigo-600 text-white
                    flex items-center justify-center
                    hover:bg-indigo-700 transition duration-200 disabled:opacity-50"
        >
          <BsFillSendFill />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
