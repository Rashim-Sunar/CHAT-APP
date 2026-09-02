import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent } from "react";
import { BsFillSendFill } from "react-icons/bs";
import { FiPaperclip, FiImage, FiFilm, FiFileText, FiPlay, FiX, FiAlertCircle, FiCheck, FiCornerUpLeft, FiMic, FiSquare } from "react-icons/fi";
import { BiBlock } from "react-icons/bi";
import useSendMessage from "../../hooks/useSendMessage";
import useConversation from "../../zustand/useConversation";
import useGetConversations from "../../hooks/useGetConversations";
import { useAuthContext } from "../../context/Auth-Context";
import { validateFileForUpload } from "../../Utils/mediaValidation";
import { getMessageBodyText } from "../../Utils/messageDisplay";
import { apiFetch } from "../../Utils/apiFetch";
import { getErrorMessage } from "../../Utils/getErrorMessage";
import toast from "react-hot-toast";
import type { ApiErrorResponse, UploadJob } from "../../types";

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
  const { refetch: refetchConversations } = useGetConversations();
  const uploadQueue = useConversation((state) => state.uploadQueue);
  const selectedConversation = useConversation((state) => state.selectedConversation);
  const replyTarget = useConversation((state) => state.replyTarget);
  const setReplyTarget = useConversation((state) => state.setReplyTarget);
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [isUnblocking, setIsUnblocking] = useState(false);
  const [attachMenuOpen, setAttachMenuOpen] = useState(false);
  const attachMenuRef = useRef<HTMLDivElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordingStreamRef = useRef<MediaStream | null>(null);
  const recordingChunksRef = useRef<Blob[]>([]);
  const discardRecordingRef = useRef(false);
  const recordingReplyToRef = useRef<string | undefined>();
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  // Close the attach dropdown when the user clicks outside it
  useEffect(() => {
    if (!attachMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (attachMenuRef.current && !attachMenuRef.current.contains(e.target as Node)) {
        setAttachMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [attachMenuOpen]);

  useEffect(() => {
    if (!isRecording) return;
    const timer = window.setInterval(() => setRecordingSeconds((seconds) => seconds + 1), 1000);
    return () => window.clearInterval(timer);
  }, [isRecording]);

  useEffect(() => () => {
    // Releasing the stream is important: otherwise an unmounted composer can
    // leave the browser microphone indicator on.
    discardRecordingRef.current = true;
    if (mediaRecorderRef.current?.state === "recording") mediaRecorderRef.current.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  }, []);

  const currentUserId = authUser?.data?.user?._id;
  const isBlocked = Boolean(selectedConversation?.isBlocked);
  const blockedByMe = Boolean(selectedConversation?.blockedByMe);

  const handleUnblock = async () => {
    if (!selectedConversation) return;

    setIsUnblocking(true);
    try {
      await apiFetch<ApiErrorResponse>(`/conversations/${selectedConversation._id}/block`, {
        method: "DELETE",
      });
      await refetchConversations();
      toast.success("Contact unblocked");
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setIsUnblocking(false);
    }
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isBlocked) return;
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

  const formatRecordingDuration = (seconds: number) =>
    `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")}`;

  const stopRecording = (discard = false) => {
    discardRecordingRef.current = discard;
    const recorder = mediaRecorderRef.current;
    if (recorder?.state === "recording") recorder.stop();
    recordingStreamRef.current?.getTracks().forEach((track) => track.stop());
  };

  const startRecording = async () => {
    if (isBlocked || isRecording || loading) return;
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      toast.error("Voice messages aren't supported in this browser");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const preferredMimeType = "audio/webm;codecs=opus";
      const mimeType = MediaRecorder.isTypeSupported(preferredMimeType) ? preferredMimeType : "";
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);

      recordingChunksRef.current = [];
      discardRecordingRef.current = false;
      recordingReplyToRef.current = replyTarget?._id;
      recordingStreamRef.current = stream;
      mediaRecorderRef.current = recorder;
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) recordingChunksRef.current.push(event.data);
      };
      recorder.onstop = () => {
        const actualMimeType = recorder.mimeType || "audio/webm";
        const chunks = recordingChunksRef.current;
        const shouldDiscard = discardRecordingRef.current || chunks.length === 0;
        recordingChunksRef.current = [];
        mediaRecorderRef.current = null;
        recordingStreamRef.current = null;
        setIsRecording(false);

        if (shouldDiscard) return;

        const extension = actualMimeType.includes("ogg") ? "ogg" : actualMimeType.includes("mp4") ? "m4a" : "webm";
        const audioFile = new File([new Blob(chunks, { type: actualMimeType })], `voice-message-${Date.now()}.${extension}`, {
          type: actualMimeType,
        });
        void sendFiles([audioFile], recordingReplyToRef.current);
        setReplyTarget(null);
      };
      recorder.start();
      setRecordingSeconds(0);
      setIsRecording(true);
    } catch (error: unknown) {
      toast.error(error instanceof DOMException && error.name === "NotAllowedError" ? "Microphone permission was denied" : "Couldn't start recording");
    }
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
          : replyTarget.messageType === "audio"
            ? "Voice message"
          : replyTarget.messageType === "file"
            ? replyTarget.fileName || "File"
            : getMessageBodyText(replyTarget)
    : "";
  const replySenderName = replyTarget
    ? String(replyTarget.senderId) === String(currentUserId)
      ? "You"
      : selectedConversation?.participants.find(
          (participant) => participant._id === String(replyTarget.senderId)
        )?.userName || "them"
    : "";

  if (isBlocked) {
    return (
      <div className="flex items-center gap-3 p-4">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-rose-50 text-rose-500">
          <BiBlock size={18} />
        </span>
        <p className="min-w-0 flex-1 text-sm text-slate-600">
          {blockedByMe
            ? "You blocked this contact. Unblock to send messages."
            : "You can't message this contact right now."}
        </p>
        {blockedByMe && (
          <button
            type="button"
            onClick={() => void handleUnblock()}
            disabled={isUnblocking}
            className="shrink-0 rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
          >
            Unblock
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="message-composer p-4 space-y-3">
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
        {isRecording ? (
          <div className="flex h-12 min-w-0 flex-1 items-center gap-3 rounded-full border border-rose-200 bg-rose-50 px-4 text-sm text-rose-700">
            <span className="h-2.5 w-2.5 shrink-0 animate-pulse rounded-full bg-rose-500" aria-hidden="true" />
            <span className="font-medium">Recording {formatRecordingDuration(recordingSeconds)}</span>
            <button
              type="button"
              onClick={() => stopRecording(true)}
              className="ml-auto text-xs font-semibold text-slate-500 hover:text-rose-700"
            >
              Cancel
            </button>
          </div>
        ) : (
        <input
          type="text"
          placeholder="Type a message..."
          className="composer-input h-12 min-w-0 flex-1 rounded-full border border-slate-300 px-4
                    focus:outline-none focus:ring-2 focus:ring-indigo-500
                    transition duration-200"
          value={message}
          onChange={(event) => setMessage(event.target.value)}
        />
        )}

        {/* ── Attach button + upward dropdown ─────────────────────── */}
        <div ref={attachMenuRef} className="relative shrink-0">
          <button
            id="attach-menu-btn"
            type="button"
            aria-label="Attach file"
            aria-expanded={attachMenuOpen}
            aria-haspopup="true"
            onClick={() => setAttachMenuOpen((prev) => !prev)}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors duration-200 ${
              attachMenuOpen
                ? "bg-indigo-100 text-indigo-600"
                : "text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
            }`}
          >
            <FiPaperclip size={20} />
          </button>

          {attachMenuOpen && (
            <div
              role="menu"
              aria-labelledby="attach-menu-btn"
              className="absolute bottom-full right-0 mb-2 w-52 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5"
            >
              {/* Photo */}
              <label
                role="menuitem"
                className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                onClick={() => setAttachMenuOpen(false)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-rose-50 text-rose-500">
                  <FiImage size={16} />
                </span>
                <span className="font-medium">Photo</span>
                <input
                  type="file"
                  className="hidden"
                  accept="image/*"
                  multiple
                  onChange={handleFileSelection}
                />
              </label>

              {/* Video */}
              <label
                role="menuitem"
                className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                onClick={() => setAttachMenuOpen(false)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-500">
                  <FiFilm size={16} />
                </span>
                <span className="font-medium">Video</span>
                <input
                  type="file"
                  className="hidden"
                  accept="video/*"
                  multiple
                  onChange={handleFileSelection}
                />
              </label>

              {/* Document */}
              <label
                role="menuitem"
                className="flex cursor-pointer items-center gap-3 px-4 py-3 text-sm text-slate-700 transition-colors hover:bg-indigo-50 hover:text-indigo-700"
                onClick={() => setAttachMenuOpen(false)}
              >
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-500">
                  <FiFileText size={16} />
                </span>
                <span className="font-medium">Document</span>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.txt,.zip"
                  multiple
                  onChange={handleFileSelection}
                />
              </label>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={isRecording ? () => stopRecording() : () => void startRecording()}
          disabled={loading}
          aria-label={isRecording ? "Stop and send voice message" : "Record voice message"}
          title={isRecording ? "Stop and send" : "Record voice message"}
          className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-50 ${
            isRecording ? "bg-rose-500 text-white hover:bg-rose-600" : "text-slate-500 hover:bg-slate-100 hover:text-indigo-600"
          }`}
        >
          {isRecording ? <FiSquare size={16} /> : <FiMic size={20} />}
        </button>

        <button
          type="submit"
          disabled={loading}
          className="send-message-button flex h-12 w-12 shrink-0 items-center justify-center rounded-full
                    bg-indigo-600 text-white
                    hover:bg-indigo-700 transition duration-200 disabled:opacity-50"
        >
          <BsFillSendFill />
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
