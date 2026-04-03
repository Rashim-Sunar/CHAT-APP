import { useState } from "react"
import useConversation from "../zustand/useConversation"
import toast from 'react-hot-toast'
import { useAuthContext } from "../context/Auth-Context"
import { getConversationKey } from "../Utils/conversationKey"
import { uploadFilesToCloudinary } from "../Utils/uploadService"

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

    // Persists a server-confirmed message into the conversation-scoped store.
    // Routing by conversation key prevents cross-chat rendering issues.
    const persistMessage = (outgoingMessage) => {
        // Keep one canonical key strategy across the app: participants-based key.
        // conversationId is still useful metadata, but not used as a local store bucket key.
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

    // Single API call wrapper used by both text and media flows.
    // Centralizing this path guarantees identical normalization behavior.
    const sendPayload = async(payload) => {
        const res = await fetch(`/api/messages/send/${selectedConversation._id}`, {
            method: "POST",
            headers: {"Content-Type":"application/json"},
            body: JSON.stringify(payload)
        });

        const data = await res.json();
        if(data.error) throw new Error(data.error);

        const outgoingMessage = data?.newMessage;
        if (outgoingMessage) {
            persistMessage(outgoingMessage);
        }
    }

    // Sends a plain text message.
    const sendMessage = async(message) => {
        if (!selectedConversation?._id) return;

        setLoading(true);
        try {
            await sendPayload({ messageType: "text", text: message });
            
        } catch (error) {
            toast.error(error.message);
        }finally{
            setLoading(false);
        }
    }

    // Uploads files in parallel, then sends one chat message per successful upload.
    // Failures are isolated per item so successful uploads are never rolled back.
    const sendFiles = async(fileList) => {
        if (!selectedConversation?._id || !fileList?.length) return;

        const files = Array.from(fileList);
        const jobs = files.map((file) => ({
            id: `${Date.now()}_${Math.random().toString(16).slice(2)}_${file.name}`,
            fileName: file.name,
            progress: 0,
            status: "uploading",
            error: null,
        }));

        // Queue-first update keeps UI responsive while async work starts.
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

            // For each successful cloud upload, send corresponding media message.
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
        } catch (error) {
            toast.error(error.message);
        } finally {
            setLoading(false);
            // Short delay allows users to see final status before queue cleanup.
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

    return {loading, sendMessage, sendFiles};
}

export default useSendMessage
