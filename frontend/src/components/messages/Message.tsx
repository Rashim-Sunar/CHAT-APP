import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { FiEdit2, FiTrash2 } from "react-icons/fi";
import { useAuthContext } from "../../context/Auth-Context";
import useConversation from "../../zustand/useConversation";
import { getConversationKey } from "../../Utils/conversationKey";
import { extractTime } from "../../Utils/extractTime";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import {
  downloadFileWithFallback,
  getCloudinaryAttachmentUrl,
  openFileWithFallback,
} from "../../Utils/fileDownload";
import {
  getMessageBodyText,
  isMessageEdited,
  shouldHideMessageForUser,
  DELETED_MESSAGE_TEXT,
} from "../../Utils/messageDisplay";
import type { Message as ChatMessage } from "../../types";
import useMessageActions from "../../hooks/useMessageActions";
import MessageDeleteModal from "./MessageDeleteModal";

interface MessageProps {
  message: ChatMessage;
}

const Message = ({ message }: MessageProps) => {
  const { authUser } = useAuthContext();
  const { selectedConversation, messagesByConversation } = useConversation();
  const { editMessage, deleteMessage, isBusy, canEdit, canDelete } = useMessageActions(message);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const editInputRef = useRef<HTMLInputElement | null>(null);
  const sender = authUser?.data?.user;
  const currentUserId = sender?._id;
  const fromMe = Boolean(sender && message.senderId === sender._id);
  const hiddenForCurrentUser = shouldHideMessageForUser(message, currentUserId);
  const conversationKey = getConversationKey(selectedConversation?._id, currentUserId);
  const currentConversationMessages = conversationKey ? messagesByConversation[conversationKey] || [] : [];

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [draftText, setDraftText] = useState(message.text || message.message || "");

  const profilePic = fromMe
    ? getAvatarByGender(sender?.gender)
    : getAvatarByGender(selectedConversation?.gender);

  const formattedTime = extractTime(message.createdAt);
  const canOpenActions = fromMe && canDelete && !message.deletedForEveryone;
  const canEditText = canOpenActions && canEdit && message.messageType === "text";
  const selectedConversationSeenAt = selectedConversation?.seenAt ? new Date(selectedConversation.seenAt) : null;

  const latestOutgoingMessageId = (() => {
    for (let index = currentConversationMessages.length - 1; index >= 0; index -= 1) {
      const currentMessage = currentConversationMessages[index];
      if (!currentMessage || shouldHideMessageForUser(currentMessage, currentUserId)) {
        continue;
      }

      if (String(currentMessage.senderId) === String(currentUserId)) {
        return currentMessage._id;
      }
    }

    return undefined;
  })();

  const showSeenIndicator = Boolean(
    fromMe &&
      message._id &&
      latestOutgoingMessageId &&
      String(latestOutgoingMessageId) === String(message._id) &&
      selectedConversationSeenAt &&
      new Date(message.createdAt).getTime() <= selectedConversationSeenAt.getTime()
  );

  useEffect(() => {
    if (!isEditing) {
      setDraftText(message.text || message.message || "");
    }
  }, [isEditing, message.message, message.text, message._id]);

  useEffect(() => {
    if (isEditing) {
      editInputRef.current?.focus();
      editInputRef.current?.select();
    }
  }, [isEditing]);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (!menuRef.current) return;
      if (!menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, []);

  if (hiddenForCurrentUser) {
    return null;
  }

  const closeActionMenu = () => setIsMenuOpen(false);

  const startEditing = () => {
    setDraftText(message.text || message.message || "");
    setIsEditing(true);
    closeActionMenu();
  };

  const cancelEditing = () => {
    setDraftText(message.text || message.message || "");
    setIsEditing(false);
  };

  const handleSaveEdit = async () => {
    const success = await editMessage(draftText);
    if (success) {
      setIsEditing(false);
      closeActionMenu();
    }
  };

  const handleDelete = async (deleteType: "me" | "everyone") => {
    setIsDeleteModalOpen(false);
    closeActionMenu();
    await deleteMessage(deleteType);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      void handleSaveEdit();
    }

    if (event.key === "Escape") {
      event.preventDefault();
      cancelEditing();
    }
  };

  const renderMessageBody = () => {
    if (message.deletedForEveryone) {
      return (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-100 px-4 py-3 text-sm italic text-slate-500 shadow-sm">
          {DELETED_MESSAGE_TEXT}
        </div>
      );
    }

    if (isEditing && message.messageType === "text") {
      return (
        <div className={`px-4 py-3 rounded-2xl shadow-sm ${fromMe ? "bg-indigo-600" : "bg-white"}`}>
          <input
            ref={editInputRef}
            type="text"
            value={draftText}
            onChange={(event) => setDraftText(event.target.value)}
            onKeyDown={handleKeyDown}
            className={`w-full bg-transparent text-sm outline-none ${fromMe ? "text-white placeholder:text-indigo-100" : "text-slate-800"}`}
            aria-label="Edit message"
          />
          <p className={`mt-2 text-[11px] ${fromMe ? "text-indigo-100/80" : "text-slate-400"}`}>
            Press Enter to save, Esc to cancel
          </p>
        </div>
      );
    }

    if (message.messageType === "image" && message.fileUrl) {
      return (
        <a href={message.fileUrl} target="_blank" rel="noreferrer" className="block">
          <img
            src={message.fileUrl}
            alt={message.fileName || "Shared image"}
            className="max-h-72 w-auto rounded-xl object-cover"
          />
        </a>
      );
    }

    if (message.messageType === "video" && message.fileUrl) {
      return (
        <video controls className="max-h-72 rounded-xl">
          <source src={message.fileUrl} type={message.mimeType || "video/mp4"} />
        </video>
      );
    }

    if (message.messageType === "file" && message.fileUrl) {
      const attachmentUrl = getCloudinaryAttachmentUrl(message.fileUrl, message.fileName);
      const bubbleClass = fromMe
        ? "bg-indigo-600 text-white rounded-br-none"
        : "bg-white text-slate-800 rounded-bl-none";

      return (
        <div className={`px-4 py-3 rounded-2xl shadow-sm inline-flex flex-col gap-2 min-w-[220px] ${bubbleClass}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="font-medium block truncate">{message.fileName || "Shared file"}</span>
              <span className="text-xs opacity-80 block">{message.mimeType || "application/octet-stream"}</span>
            </div>
            <span className="text-xs opacity-80 whitespace-nowrap">File</span>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <button
              type="button"
              onClick={() =>
                openFileWithFallback(message.fileUrl, message.fileName, message.publicId, message.messageType)
              }
              className="text-xs font-medium underline underline-offset-2"
            >
              Open
            </button>

            <button
              type="button"
              onClick={() =>
                downloadFileWithFallback(
                  attachmentUrl || message.fileUrl,
                  message.fileName,
                  message.publicId,
                  message.messageType
                )
              }
              className="text-xs font-medium underline underline-offset-2"
            >
              Download
            </button>

            <button
              type="button"
              onClick={() =>
                downloadFileWithFallback(
                  attachmentUrl || message.fileUrl,
                  message.fileName,
                  message.publicId,
                  message.messageType
                )
              }
              className="text-xs font-medium underline underline-offset-2"
            >
              Save
            </button>
          </div>
        </div>
      );
    }

    const bubbleClass = fromMe
      ? "bg-indigo-600 text-white rounded-br-none"
      : "bg-white text-slate-800 rounded-bl-none";

    return (
      <div className={`px-4 py-2 rounded-2xl shadow-sm ${bubbleClass}`}>
        {getMessageBodyText(message)}
      </div>
    );
  };

  return (
    <div className={`group flex mb-4 ${fromMe ? "justify-end" : "justify-start"}`} onContextMenu={(event) => {
      if (!canOpenActions || isEditing) return;
      event.preventDefault();
      setIsMenuOpen(true);
    }}>
      {!fromMe && <img src={profilePic} className="mr-2 h-8 w-8 rounded-full" alt="avatar" />}

      <div ref={menuRef} className="relative max-w-xs md:max-w-md">
        <div className="relative">
          {renderMessageBody()}

          {canOpenActions && !isEditing && (
            <button
              type="button"
              onClick={() => setIsMenuOpen((current) => !current)}
              className="absolute -right-2 -top-2 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition duration-200 hover:bg-slate-100 group-hover:opacity-100 focus:opacity-100"
              aria-label="Open message actions"
            >
              <HiOutlineDotsVertical size={14} />
            </button>
          )}

          {isMenuOpen && canOpenActions && !isEditing && (
            <div className="absolute right-0 top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl">
              {canEditText && (
                <button
                  type="button"
                  onClick={startEditing}
                  disabled={isBusy}
                  className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  <FiEdit2 size={14} />
                  Edit
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setIsDeleteModalOpen(true);
                  closeActionMenu();
                }}
                disabled={isBusy}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-rose-600 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <FiTrash2 size={14} />
                Delete
              </button>
            </div>
          )}
        </div>

        <div className="mt-1 flex items-center justify-end gap-2 text-xs text-slate-400">
          <span>{formattedTime}</span>
          {isMessageEdited(message) && <span className="italic text-slate-400">(edited)</span>}
        </div>

        {showSeenIndicator && (
          <div className="mt-0.5 text-right text-[11px] font-medium text-emerald-600">
            Seen
          </div>
        )}
      </div>

      <MessageDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDeleteForMe={() => void handleDelete("me")}
        onDeleteForEveryone={() => void handleDelete("everyone")}
        isDeleting={isBusy}
      />
    </div>
  );
};

export default Message;