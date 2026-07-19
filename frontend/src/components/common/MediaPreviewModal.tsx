import { AnimatePresence, motion } from "framer-motion";
import { FiX } from "react-icons/fi";

interface MediaPreviewItem {
  type: "image" | "video";
  url: string;
}

interface MediaPreviewModalProps {
  item: MediaPreviewItem | null;
  onClose: () => void;
}

// Shared image/video lightbox so clicking a picture opens it in-place instead
// of navigating away to a new tab.
const MediaPreviewModal = ({ item, onClose }: MediaPreviewModalProps) => (
  <AnimatePresence>
    {item && (
      <motion.div
        className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        role="dialog"
        aria-modal="true"
      >
        <motion.div
          className="relative max-w-3xl w-full max-h-[85vh]"
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={(event) => event.stopPropagation()}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute -top-10 right-0 h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"
            aria-label="Close media preview"
          >
            <FiX />
          </button>

          {item.type === "image" ? (
            <img
              src={item.url}
              alt="Preview shared media"
              className="w-full max-h-[85vh] rounded-xl object-contain bg-black"
            />
          ) : (
            <video controls autoPlay className="w-full max-h-[85vh] rounded-xl bg-black">
              <source src={item.url} type="video/mp4" />
            </video>
          )}
        </motion.div>
      </motion.div>
    )}
  </AnimatePresence>
);

export default MediaPreviewModal;
