import { useMemo, useState } from "react";
import { BiX } from "react-icons/bi";
import { IoSearchSharp } from "react-icons/io5";
import toast from "react-hot-toast";
import useGetConversations from "../../hooks/useGetConversations";
import { useAuthContext } from "../../context/Auth-Context";
import useConversation from "../../zustand/useConversation";
import Avatar from "../common/Avatar";
import { apiFetch } from "../../Utils/apiFetch";
import { getConversationKey } from "../../Utils/conversationKey";
import {
  decryptMessageIfNeeded,
  encryptTextMessage,
  getPublicKeyByUserId,
  requireUserKeyPair,
} from "../../Utils/crypto";
import { getErrorMessage } from "../../Utils/getErrorMessage";
import type { ApiErrorResponse, Message } from "../../types";

interface ForwardMessageModalProps {
  isOpen: boolean;
  message: Message;
  onClose: () => void;
}

/**
 * Multi-select "forward to..." picker. Text messages are re-encrypted fresh
 * for each target's public key (the original ciphertext is unreadable by
 * anyone but the original receiver); media messages reuse the existing
 * Cloudinary asset with no re-upload.
 */
const ForwardMessageModal = ({ isOpen, message, onClose }: ForwardMessageModalProps) => {
  const { authUser } = useAuthContext();
  const { conversations } = useGetConversations();
  const { appendMessageToConversation, upsertConversationFromMessage } = useConversation();
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [isSending, setIsSending] = useState(false);

  const currentUserId = authUser?.data?.user?._id;

  const filteredConversations = useMemo(
    () =>
      conversations.filter((conversation) =>
        conversation.userName.toLowerCase().includes(search.trim().toLowerCase())
      ),
    [conversations, search]
  );

  if (!isOpen) return null;

  const toggleSelection = (conversationId: string) => {
    setSelectedIds((current) =>
      current.includes(conversationId)
        ? current.filter((id) => id !== conversationId)
        : [...current, conversationId]
    );
  };

  const handleClose = () => {
    setSearch("");
    setSelectedIds([]);
    onClose();
  };

  // Mirrors useSendMessage's persistMessage so a forwarded message shows up
  // immediately in the target conversation and its sidebar preview, exactly
  // like a normal send would.
  const persistForwardedMessage = async (outgoingMessage: Message): Promise<void> => {
    if (!currentUserId) return;

    const normalizedMessage = await decryptMessageIfNeeded(outgoingMessage, currentUserId);
    const conversationKey = getConversationKey(normalizedMessage?.senderId, normalizedMessage?.receiverId);

    if (!conversationKey) return;

    appendMessageToConversation(conversationKey, normalizedMessage);
    upsertConversationFromMessage(normalizedMessage, currentUserId);
  };

  const forwardToConversation = async (targetId: string): Promise<void> => {
    if (!currentUserId) throw new Error("Not authenticated");

    if (message.messageType === "text") {
      if (message.decryptionFailed) {
        throw new Error("This message could not be decrypted, so it can't be forwarded");
      }

      const plainText = (message.text || message.message || "").trim();
      if (!plainText) throw new Error("Message has no content to forward");

      const { publicKey: senderPublicKey } = await requireUserKeyPair(currentUserId);
      const receiverPublicKey = await getPublicKeyByUserId(targetId);
      const encryptedPayload = await encryptTextMessage(plainText, receiverPublicKey, senderPublicKey);

      const data = await apiFetch<ApiErrorResponse & { newMessage?: Message }>(`/messages/send/${targetId}`, {
        method: "POST",
        body: JSON.stringify({
          messageType: "text",
          ...encryptedPayload,
          forwarded: true,
        }),
      });
      if (data.error) throw new Error(data.error);
      if (data.newMessage) await persistForwardedMessage(data.newMessage);
      return;
    }

    // Media messages reuse the existing Cloudinary asset — no re-upload needed.
    const data = await apiFetch<ApiErrorResponse & { newMessage?: Message }>(`/messages/send/${targetId}`, {
      method: "POST",
      body: JSON.stringify({
        messageType: message.messageType,
        fileUrl: message.fileUrl,
        fileName: message.fileName,
        fileSize: message.fileSize,
        mimeType: message.mimeType,
        publicId: message.publicId,
        forwarded: true,
      }),
    });
    if (data.error) throw new Error(data.error);
    if (data.newMessage) await persistForwardedMessage(data.newMessage);
  };

  const handleForward = async () => {
    if (selectedIds.length === 0) return;

    setIsSending(true);
    try {
      const results = await Promise.allSettled(selectedIds.map((id) => forwardToConversation(id)));
      const failures = results.filter((result) => result.status === "rejected");

      if (failures.length === 0) {
        toast.success(
          selectedIds.length === 1 ? "Message forwarded" : `Forwarded to ${selectedIds.length} chats`
        );
        handleClose();
      } else if (failures.length < selectedIds.length) {
        toast.error(`${failures.length} of ${selectedIds.length} forwards failed`);
        handleClose();
      } else {
        toast.error(getErrorMessage(failures[0].reason, "Forward failed"));
      }
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={handleClose}
    >
      <div
        className="flex max-h-[80vh] w-full max-w-sm flex-col overflow-hidden rounded-2xl bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h4 className="text-lg font-semibold text-slate-900">Forward message</h4>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Close"
            className="rounded-md p-1.5 hover:bg-slate-100"
          >
            <BiX className="h-5 w-5 text-slate-600" />
          </button>
        </div>

        <div className="border-b border-slate-100 px-5 py-3">
          <div className="relative">
            <IoSearchSharp className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search chats"
              className="h-10 w-full rounded-full bg-slate-100 pl-10 pr-4 text-sm transition focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-2">
          {filteredConversations.length === 0 ? (
            <p className="px-5 py-6 text-center text-sm text-slate-400">No chats found</p>
          ) : (
            filteredConversations.map((conversation) => {
              const isSelected = selectedIds.includes(conversation._id);

              return (
                <button
                  key={conversation._id}
                  type="button"
                  onClick={() => toggleSelection(conversation._id)}
                  className="flex w-full items-center gap-3 px-5 py-2.5 transition hover:bg-slate-50"
                >
                  <Avatar
                    src={conversation.profilePic}
                    gender={conversation.gender}
                    name={conversation.userName}
                    alt="avatar"
                    className="h-10 w-10 shrink-0 rounded-full object-cover"
                  />
                  <span className="min-w-0 flex-1 truncate text-left text-sm font-medium text-slate-800">
                    {conversation.userName}
                  </span>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 transition ${
                      isSelected ? "border-indigo-600 bg-indigo-600" : "border-slate-300"
                    }`}
                  >
                    {isSelected && <span className="h-2 w-2 rounded-full bg-white" />}
                  </span>
                </button>
              );
            })
          )}
        </div>

        <div className="border-t border-slate-200 px-5 py-4">
          <button
            type="button"
            onClick={() => void handleForward()}
            disabled={selectedIds.length === 0 || isSending}
            className="w-full rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSending
              ? "Forwarding..."
              : selectedIds.length > 0
                ? `Forward to ${selectedIds.length} ${selectedIds.length === 1 ? "chat" : "chats"}`
                : "Select a chat"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ForwardMessageModal;
