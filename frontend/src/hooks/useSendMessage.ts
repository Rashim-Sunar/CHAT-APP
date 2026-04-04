import { useState } from "react";
import toast from "react-hot-toast";
import useConversation from "../zustand/useConversation";
import { useAuthContext } from "../context/Auth-Context";
import { getConversationKey } from "../Utils/conversationKey";
import { uploadFilesToCloudinary } from "../Utils/uploadService";
import { getErrorMessage } from "../Utils/getErrorMessage";
import type { ApiErrorResponse, Message, SendMessagePayload } from "../types";

const useSendMessage = () => {
  const [loading, setLoading] = useState(false);
  const { authUser } = useAuthContext();
  const {
    selectedConversation,
    appendMessageToConversation,
    upsertConversationFromMessage,
    addUploadJobs,
    updateUploadJob,
    removeUploadJob,
  } = useConversation();

  const currentUserId = authUser?.data?.user?._id;

  const persistMessage = (outgoingMessage: Message) => {
    const conversationKey = getConversationKey(
      outgoingMessage?.senderId,
      outgoingMessage?.receiverId
    );

    if (conversationKey && outgoingMessage) {
      appendMessageToConversation(conversationKey, outgoingMessage);

      if (currentUserId) {
        upsertConversationFromMessage(outgoingMessage, currentUserId);
      }
    }
  };

  const sendPayload = async (payload: SendMessagePayload): Promise<void> => {
    const res = await fetch(`/api/messages/send/${selectedConversation?._id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    const data = (await res.json()) as ApiErrorResponse & { newMessage?: Message };
    if (data.error) throw new Error(data.error);

    const outgoingMessage = data?.newMessage;
    if (outgoingMessage) {
      persistMessage(outgoingMessage);
    }
  };

  const sendMessage = async (message: string): Promise<void> => {
    if (!selectedConversation?._id) return;

    setLoading(true);
    try {
      await sendPayload({ messageType: "text", text: message });
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
    }
  };

  const sendFiles = async (fileList: FileList | File[] | null | undefined): Promise<void> => {
    if (!selectedConversation?._id || !fileList?.length) return;

    const files = Array.from(fileList);
    const jobs = files.map((file) => ({
      id: `${Date.now()}_${Math.random().toString(16).slice(2)}_${file.name}`,
      fileName: file.name,
      progress: 0,
      status: "uploading" as const,
      error: null,
    }));

    addUploadJobs(jobs);
    setLoading(true);

    try {
      const uploadResults = await uploadFilesToCloudinary({
        files,
        onProgress: (index, progress) => {
          const job = jobs[index];
          if (!job) return;
          updateUploadJob(job.id, { progress });
        },
      });

      const sendResults = await Promise.allSettled(
        uploadResults.map(async (result, index) => {
          const job = jobs[index];
          if (!job) return;

          if (result.status === "rejected") {
            updateUploadJob(job.id, {
              status: "failed",
              error: result.reason?.message || "Upload failed",
            });
            return;
          }

          const mediaMessagePayload = result.value;
          await sendPayload(mediaMessagePayload);
          updateUploadJob(job.id, { status: "completed", progress: 100 });
        })
      );

      const uploadFailures = uploadResults.filter((result) => result.status === "rejected").length;
      const sendFailures = sendResults.filter((result) => result.status === "rejected").length;
      const failures = uploadFailures + sendFailures;
      if (failures > 0) {
        toast.error(`${failures} file(s) failed. Others were sent successfully.`);
      }
    } catch (error: unknown) {
      toast.error(getErrorMessage(error));
    } finally {
      setLoading(false);
      setTimeout(() => {
        jobs.forEach((job) => {
          const queueJob = useConversation.getState().uploadQueue.find(
            (item) => item.id === job.id
          );

          if (queueJob?.status !== "uploading") {
            removeUploadJob(job.id);
          }
        });
      }, 800);
    }
  };

  return { loading, sendMessage, sendFiles };
};

export default useSendMessage;