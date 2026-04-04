import { useState, type ChangeEvent, type FormEvent } from "react";
import { BsFillSendFill } from "react-icons/bs";
import { FiImage, FiFileText, FiVideo } from "react-icons/fi";
import useSendMessage from "../../hooks/useSendMessage";
import useConversation from "../../zustand/useConversation";
import { validateFileForUpload } from "../../Utils/mediaValidation";
import toast from "react-hot-toast";

const MessageInput = () => {
  const { loading, sendMessage, sendFiles } = useSendMessage();
  const uploadQueue = useConversation((state) => state.uploadQueue);
  const [message, setMessage] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!message.trim() && selectedFiles.length === 0) return;

    if (message.trim()) {
      await sendMessage(message);
      setMessage("");
    }

    if (selectedFiles.length > 0) {
      await sendFiles(selectedFiles);
      setSelectedFiles([]);
    }
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

  return (
    <div className="p-4 space-y-3">
      {selectedFiles.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {selectedFiles.map((file) => {
            const isImage = file.type.startsWith("image/");
            const isVideo = file.type.startsWith("video/");

            return (
              <div
                key={`${file.name}-${file.size}`}
                className="flex items-center gap-2 border border-slate-200 rounded-xl px-3 py-2 bg-slate-50"
              >
                <div className="text-slate-500">
                  {isImage ? <FiImage /> : isVideo ? <FiVideo /> : <FiFileText />}
                </div>
                <p className="text-xs text-slate-700 truncate flex-1">{file.name}</p>
                <button
                  type="button"
                  className="text-xs text-rose-600"
                  onClick={() => removeSelectedFile(file.name)}
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}

      {uploadQueue.length > 0 && (
        <div className="space-y-1">
          {uploadQueue.map((job) => (
            <div key={job.id} className="text-xs text-slate-600">
              <div className="flex justify-between">
                <span className="truncate max-w-[70%]">{job.fileName}</span>
                <span>{job.status === "failed" ? "failed" : `${Math.min(job.progress || 0, 100)}%`}</span>
              </div>
              <div className="h-1.5 bg-slate-200 rounded-full mt-1 overflow-hidden">
                <div
                  className={`h-full ${job.status === "failed" ? "bg-rose-500" : "bg-indigo-500"}`}
                  style={{ width: `${Math.min(job.progress || 0, 100)}%` }}
                />
              </div>
            </div>
          ))}
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