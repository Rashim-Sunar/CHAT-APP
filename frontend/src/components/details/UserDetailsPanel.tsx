import { useEffect, useMemo, useState, type KeyboardEvent as ReactKeyboardEvent } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown, FiChevronUp, FiDownload, FiFileText, FiImage, FiLink2, FiX } from "react-icons/fi";
import useConversation from "../../zustand/useConversation";
import useUserDetails from "../../hooks/useUserDetails";
import { getAvatarByGender } from "../../Utils/getAvatarByGender";
import { useSocketContext } from "../../context/SocketContext";
import type { SharedDocumentItem, SharedLinkItem, SharedMediaItem } from "../../types";

interface UserDetailsPanelProps {
  isOpen: boolean;
  onClose?: () => void;
  variant?: "desktop" | "drawer";
}

type SectionKey = "media" | "links" | "documents";

const slidePanelVariants = {
  hidden: { x: "100%", opacity: 0 },
  visible: {
    x: 0,
    opacity: 1,
    transition: { type: "spring", stiffness: 300, damping: 30 },
  },
  exit: { x: "100%", opacity: 0, transition: { duration: 0.2 } },
} as const;

const formatDate = (value: string): string => {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatFileSize = (size?: number): string => {
  if (!size || size <= 0) return "";

  const units = ["B", "KB", "MB", "GB"];
  let currentSize = size;
  let unitIndex = 0;

  while (currentSize >= 1024 && unitIndex < units.length - 1) {
    currentSize /= 1024;
    unitIndex += 1;
  }

  return `${currentSize.toFixed(currentSize < 10 && unitIndex > 0 ? 1 : 0)} ${units[unitIndex]}`;
};

const getDomain = (url: string): string => {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "External link";
  }
};

const SkeletonRows = () => (
  <div className="space-y-3 animate-pulse">
    <div className="h-24 rounded-xl bg-slate-200/70" />
    <div className="h-12 rounded-xl bg-slate-200/70" />
    <div className="h-12 rounded-xl bg-slate-200/70" />
  </div>
);

const MediaGrid = ({ items, onPreview }: { items: SharedMediaItem[]; onPreview: (item: SharedMediaItem) => void }) => {
  if (items.length === 0) {
    return <p className="text-sm text-slate-500">No media shared yet.</p>;
  }

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <button
          type="button"
          key={`${item.url}-${item.createdAt}`}
          onClick={() => onPreview(item)}
          className="relative aspect-square rounded-xl overflow-hidden group focus:outline-none focus:ring-2 focus:ring-slate-400"
        >
          {item.type === "image" ? (
            <img
              src={item.url}
              alt="Shared media"
              className="h-full w-full object-cover transition-transform duration-200 group-hover:scale-105"
            />
          ) : (
            <video className="h-full w-full object-cover" muted>
              <source src={item.url} type="video/mp4" />
            </video>
          )}

          <span className="absolute inset-0 bg-black/0 group-hover:bg-black/15 transition-colors" />
        </button>
      ))}
    </div>
  );
};

interface AccordionSectionProps {
  id: SectionKey;
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: (section: SectionKey) => void;
  icon: React.ReactNode;
  children: React.ReactNode;
}

const AccordionSection = ({ id, title, count, isOpen, onToggle, icon, children }: AccordionSectionProps) => {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors text-left"
        aria-expanded={isOpen}
        aria-controls={`section-content-${id}`}
      >
        <span className="flex items-center gap-2 text-slate-700">
          <span className="text-slate-500">{icon}</span>
          <span className="text-sm font-semibold tracking-wide uppercase">{title}</span>
          <span className="inline-flex items-center justify-center min-w-6 h-6 px-1.5 rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
            {count}
          </span>
        </span>

        <span className="text-slate-500">{isOpen ? <FiChevronUp size={17} /> : <FiChevronDown size={17} />}</span>
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`section-content-${id}`}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </section>
  );
};

const LinksList = ({ links }: { links: SharedLinkItem[] }) => {
  if (links.length === 0) {
    return <p className="text-sm text-slate-500">No links shared yet.</p>;
  }

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <a
          key={`${link.url}-${link.createdAt}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-slate-200 bg-white px-3 py-2 hover:bg-slate-50 transition-colors"
        >
          <p className="text-sm font-medium text-slate-800 truncate">{link.title}</p>
          <div className="flex items-center justify-between mt-1">
            <p className="text-xs text-slate-500 truncate">{getDomain(link.url)}</p>
            <p className="text-xs text-slate-400">{formatDate(link.createdAt)}</p>
          </div>
        </a>
      ))}
    </div>
  );
};

const DocumentsList = ({ documents }: { documents: SharedDocumentItem[] }) => {
  if (documents.length === 0) {
    return <p className="text-sm text-slate-500">No documents shared yet.</p>;
  }

  return (
    <div className="space-y-2">
      {documents.map((document) => (
        <div
          key={`${document.url}-${document.createdAt}`}
          className="rounded-xl border border-slate-200 bg-white px-3 py-2 flex items-center gap-3"
        >
          <span className="h-9 w-9 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <FiFileText />
          </span>

          <div className="min-w-0 flex-1">
            <p className="text-sm font-medium text-slate-800 truncate">{document.name}</p>
            <p className="text-xs text-slate-500">
              {[formatFileSize(document.size), formatDate(document.createdAt)].filter(Boolean).join(" • ")}
            </p>
          </div>

          <a
            href={document.url}
            target="_blank"
            rel="noreferrer"
            download={document.name}
            className="h-8 w-8 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 flex items-center justify-center transition-colors"
            aria-label={`Download ${document.name}`}
          >
            <FiDownload size={14} />
          </a>
        </div>
      ))}
    </div>
  );
};

const UserDetailsPanel = ({ isOpen, onClose, variant = "desktop" }: UserDetailsPanelProps) => {
  const { selectedConversation } = useConversation();
  const { onlineUsers } = useSocketContext();
  const { details, loading, error, refetch } = useUserDetails();
  const [previewItem, setPreviewItem] = useState<SharedMediaItem | null>(null);
  const [avatarBroken, setAvatarBroken] = useState(false);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    media: true,
    links: false,
    documents: false,
  });

  const baseAvatar = details?.user?.profilePic || selectedConversation?.profilePic || "";
  const fallbackAvatar = getAvatarByGender(selectedConversation?.gender);
  const profilePic = !avatarBroken && baseAvatar ? baseAvatar : fallbackAvatar;
  const userName = details?.user?.username || selectedConversation?.userName || "User";
  const isOnline = selectedConversation?._id ? onlineUsers.includes(selectedConversation._id) : false;
  const mediaItems = details?.media || [];
  const linkItems = details?.links || [];
  const documentItems = details?.documents || [];

  const showPanel = useMemo(() => {
    if (variant === "desktop") {
      return Boolean(selectedConversation);
    }

    return Boolean(selectedConversation) && isOpen;
  }, [isOpen, selectedConversation, variant]);

  useEffect(() => {
    if (!showPanel) {
      setPreviewItem(null);
    }
  }, [showPanel]);

  useEffect(() => {
    setAvatarBroken(false);
  }, [baseAvatar]);

  useEffect(() => {
    setOpenSections({
      media: true,
      links: false,
      documents: false,
    });
  }, [selectedConversation?._id]);

  useEffect(() => {
    const closeOnEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key === "Escape") {
        if (previewItem) {
          setPreviewItem(null);
          return;
        }

        onClose?.();
      }
    };

    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [onClose, previewItem]);

  const onContainerKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === "Escape") {
      if (previewItem) {
        setPreviewItem(null);
        return;
      }

      onClose?.();
    }
  };

  const toggleSection = (section: SectionKey) => {
    setOpenSections((previous) => ({
      ...previous,
      [section]: !previous[section],
    }));
  };

  if (!showPanel) return null;

  const panel = (
    <motion.aside
      variants={slidePanelVariants}
      initial="hidden"
      animate="visible"
      exit="exit"
      className={`h-full flex flex-col bg-slate-50 border-l border-slate-200 ${variant === "desktop" ? "w-full" : "w-full md:w-[340px]"}`}
      aria-label="User details panel"
      onKeyDown={onContainerKeyDown}
    >
      <div className="relative px-5 pt-5 pb-6 border-b border-slate-200 bg-gradient-to-b from-white to-slate-50">
        {variant === "drawer" && (
          <button
            type="button"
            onClick={onClose}
            className="absolute top-4 right-4 h-8 w-8 rounded-lg hover:bg-slate-100 text-slate-600 flex items-center justify-center"
            aria-label="Close details panel"
          >
            <FiX size={17} />
          </button>
        )}

        <div className="flex flex-col items-center text-center">
          <img
            src={profilePic}
            alt={`${userName} profile`}
            className="h-20 w-20 rounded-full object-cover border border-slate-200 shadow-sm"
            onError={() => setAvatarBroken(true)}
          />

          <div className="mt-3 min-w-0">
            <p className="text-lg font-semibold text-slate-900 truncate">{userName}</p>
            <p className="text-sm text-slate-500 mt-1 flex items-center justify-center gap-1.5">
              <span className={`inline-block h-2.5 w-2.5 rounded-full ${isOnline ? "bg-emerald-500" : "bg-slate-300"}`} aria-hidden="true" />
              {isOnline ? "Online" : "Offline"}
            </p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto px-4 md:px-5 py-4 space-y-3">
        {loading && <SkeletonRows />}

        {!loading && error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
            <p className="text-sm text-rose-700">{error}</p>
            <button
              type="button"
              onClick={refetch}
              className="mt-2 text-xs font-medium text-rose-700 underline underline-offset-2"
            >
              Retry
            </button>
          </div>
        )}

        {!loading && !error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-3">
            <AccordionSection
              id="media"
              title="Shared media"
              count={mediaItems.length}
              isOpen={openSections.media}
              onToggle={toggleSection}
              icon={<FiImage size={15} />}
            >
              <MediaGrid items={mediaItems} onPreview={setPreviewItem} />
            </AccordionSection>

            <AccordionSection
              id="links"
              title="Shared links"
              count={linkItems.length}
              isOpen={openSections.links}
              onToggle={toggleSection}
              icon={<FiLink2 size={15} />}
            >
              <LinksList links={linkItems} />
            </AccordionSection>

            <AccordionSection
              id="documents"
              title="Shared documents"
              count={documentItems.length}
              isOpen={openSections.documents}
              onToggle={toggleSection}
              icon={<FiFileText size={15} />}
            >
              <DocumentsList documents={documentItems} />
            </AccordionSection>
          </motion.div>
        )}
      </div>

      <AnimatePresence>
        {previewItem && (
          <motion.div
            className="fixed inset-0 z-[80] bg-black/70 backdrop-blur-sm p-4 flex items-center justify-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setPreviewItem(null)}
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
                onClick={() => setPreviewItem(null)}
                className="absolute -top-10 right-0 h-8 w-8 rounded-lg bg-white/20 hover:bg-white/30 text-white flex items-center justify-center"
                aria-label="Close media preview"
              >
                <FiX />
              </button>

              {previewItem.type === "image" ? (
                <img
                  src={previewItem.url}
                  alt="Preview shared media"
                  className="w-full max-h-[85vh] rounded-xl object-contain bg-black"
                />
              ) : (
                <video controls autoPlay className="w-full max-h-[85vh] rounded-xl bg-black">
                  <source src={previewItem.url} type="video/mp4" />
                </video>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.aside>
  );

  if (variant === "desktop") {
    return <AnimatePresence>{panel}</AnimatePresence>;
  }

  return (
    <AnimatePresence>
      {showPanel && (
        <motion.div className="fixed inset-0 z-50" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <button
            type="button"
            className="absolute inset-0 bg-slate-900/35"
            onClick={onClose}
            aria-label="Close details drawer backdrop"
          />
          <div className="absolute inset-y-0 right-0 w-full md:w-[340px]">{panel}</div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default UserDetailsPanel;