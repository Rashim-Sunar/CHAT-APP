import { useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent } from "react";
import { HiOutlineDotsVertical } from "react-icons/hi";
import { FiCheck, FiEdit2, FiTrash2, FiCornerUpLeft, FiCornerUpRight } from "react-icons/fi";
import { useAuthContext } from "../../context/Auth-Context";
import useConversation from "../../zustand/useConversation";
import { getConversationKey } from "../../Utils/conversationKey";
import { extractTime } from "../../Utils/extractTime";
import Avatar from "../common/Avatar";
import MediaPreviewModal from "../common/MediaPreviewModal";
import MessageReactionBar from "./MessageReactionBar";
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
import ForwardMessageModal from "./ForwardMessageModal";

interface MessageProps {
  message: ChatMessage;
}

const Message = ({ message }: MessageProps) => {
  const { authUser } = useAuthContext();
  const { selectedConversation, messagesByConversation, setReplyTarget } = useConversation();
  const { editMessage, deleteMessage, reactToMessage, isBusy, canEdit, canDelete, canDeleteForEveryone } =
    useMessageActions(message);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
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
  const [isImagePreviewOpen, setIsImagePreviewOpen] = useState(false);
  // The trigger button always sits at the bubble's top-right corner, so the
  // dropdown defaults to opening from the right (directly under it). Only
  // narrow bubbles positioned near the viewport's left edge (short received
  // messages) can push it off-screen — detected and flipped after mount.
  const [dropdownAlign, setDropdownAlign] = useState<"right" | "left">("right");
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);

  const formattedTime = extractTime(message.createdAt);
  const canOpenActions = canDelete && !message.deletedForEveryone;
  const canEditText = canOpenActions && fromMe && canEdit && message.messageType === "text";
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

  // Reply previews are resolved purely client-side from the already-loaded
  // (and, for text, already-decrypted) local message cache — the server never
  // stores a plaintext snapshot of the quoted content.
  const repliedMessage = message.replyTo
    ? currentConversationMessages.find((candidate) => candidate._id === message.replyTo) || null
    : null;

  const renderQuotedPreview = () => {
    if (!message.replyTo) return null;

    if (!repliedMessage) {
      return (
        <div className="mb-1 rounded-lg border-l-2 border-slate-300 bg-slate-50 px-2 py-1 text-xs italic text-slate-400">
          Original message unavailable
        </div>
      );
    }

    const isRepliedFromMe = String(repliedMessage.senderId) === String(currentUserId);
    const repliedSenderName = isRepliedFromMe ? "You" : selectedConversation?.userName || "them";
    const repliedSnippet = repliedMessage.deletedForEveryone
      ? DELETED_MESSAGE_TEXT
      : repliedMessage.messageType === "image"
        ? "Photo"
        : repliedMessage.messageType === "video"
          ? "Video"
          : repliedMessage.messageType === "file"
            ? repliedMessage.fileName || "File"
            : getMessageBodyText(repliedMessage);

    return (
      <div className="mb-1 max-w-full rounded-lg border-l-2 border-indigo-400 bg-slate-50 px-2 py-1">
        <p className="truncate text-xs font-semibold text-indigo-600">{repliedSenderName}</p>
        <p className="truncate text-xs text-slate-500">{repliedSnippet}</p>
      </div>
    );
  };

  const groupedReactions = (message.reactions || []).reduce<Record<string, string[]>>(
    (accumulator, reaction) => {
      accumulator[reaction.emoji] = accumulator[reaction.emoji] || [];
      accumulator[reaction.emoji].push(reaction.userId);
      return accumulator;
    },
    {}
  );

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

  useLayoutEffect(() => {
    if (!isMenuOpen) {
      setDropdownAlign("right");
      return;
    }

    const dropdownEl = dropdownRef.current;
    if (!dropdownEl) return;

    // Compare against the scrollable messages container's own boundary, not
    // the browser viewport — that container clips with overflow-x-hidden, so
    // it (not x=0) is where the dropdown actually gets cut off.
    const rect = dropdownEl.getBoundingClientRect();
    const scrollContainer = dropdownEl.closest<HTMLElement>("[data-messages-scroll-container]");
    const boundaryLeft = scrollContainer ? scrollContainer.getBoundingClientRect().left : 0;

    if (rect.left < boundaryLeft) {
      setDropdownAlign("left");
    }
  }, [isMenuOpen]);

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
        <button
          type="button"
          onClick={() => setIsImagePreviewOpen(true)}
          className="block cursor-zoom-in"
          aria-label="Open image preview"
        >
          <img
            src={message.fileUrl}
            alt={message.fileName || "Shared image"}
            className="max-h-72 w-auto rounded-xl object-cover"
          />
        </button>
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
      {!fromMe && (
        <Avatar
          src={selectedConversation?.profilePic}
          gender={selectedConversation?.gender}
          name={selectedConversation?.userName}
          alt="avatar"
          className="mr-2 h-8 w-8 rounded-full"
        />
      )}

      <div ref={menuRef} className="relative max-w-xs md:max-w-md">
        <div className="relative">
          {message.forwarded && !message.deletedForEveryone && (
            <div className="mb-1 flex items-center gap-1 text-xs italic text-slate-400">
              <FiCornerUpRight size={12} />
              Forwarded
            </div>
          )}
          {renderQuotedPreview()}
          {renderMessageBody()}

          {canOpenActions && !isEditing && (
            <div className="absolute -top-2 right-6 flex items-center gap-1">
              <MessageReactionBar
                align={fromMe ? "right" : "left"}
                onSelectEmoji={(emoji) => void reactToMessage(emoji)}
              />
            </div>
          )}

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
            <div
              ref={dropdownRef}
              className={`absolute top-10 z-20 w-44 rounded-xl border border-slate-200 bg-white p-1 shadow-xl ${
                dropdownAlign === "right" ? "right-0" : "left-0"
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  setReplyTarget(message);
                  closeActionMenu();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
              >
                <FiCornerUpLeft size={14} />
                Reply
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsForwardModalOpen(true);
                  closeActionMenu();
                }}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-100"
              >
                <FiCornerUpRight size={14} />
                Forward
              </button>

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

        {Object.keys(groupedReactions).length > 0 && (
          <div className={`mt-1 flex flex-wrap gap-1 ${fromMe ? "justify-end" : "justify-start"}`}>
            {Object.entries(groupedReactions).map(([emoji, userIds]) => {
              const isOwnReaction = Boolean(currentUserId && userIds.includes(currentUserId));

              return (
                <button
                  key={emoji}
                  type="button"
                  onClick={() => void reactToMessage(emoji)}
                  className={`flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs transition ${
                    isOwnReaction
                      ? "border-indigo-300 bg-indigo-50 text-indigo-700"
                      : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span>{emoji}</span>
                  {userIds.length > 1 && <span className="font-medium">{userIds.length}</span>}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-1 flex items-center justify-end gap-2 text-xs text-slate-400">
          <span>{formattedTime}</span>
          {isMessageEdited(message) && <span className="italic text-slate-400">(edited)</span>}
        </div>

        {showSeenIndicator && (
          <div
            className="mt-0.5 flex items-center justify-end gap-1 text-[11px] font-medium text-sky-500"
            aria-label="Message seen"
            title="Message seen"
          >
            <FiCheck size={13} />
            <FiCheck size={13} className="-ml-2" />
          </div>
        )}
      </div>

      <MessageDeleteModal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        onDeleteForMe={() => void handleDelete("me")}
        onDeleteForEveryone={() => void handleDelete("everyone")}
        canDeleteForEveryone={canDeleteForEveryone}
        isDeleting={isBusy}
      />

      {message.messageType === "image" && message.fileUrl && (
        <MediaPreviewModal
          item={isImagePreviewOpen ? { type: "image", url: message.fileUrl } : null}
          onClose={() => setIsImagePreviewOpen(false)}
        />
      )}

      <ForwardMessageModal
        isOpen={isForwardModalOpen}
        message={message}
        onClose={() => setIsForwardModalOpen(false)}
      />
    </div>
  );
};

export default Message;