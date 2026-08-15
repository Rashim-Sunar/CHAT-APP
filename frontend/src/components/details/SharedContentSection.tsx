import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { FiChevronDown, FiDownload, FiFileText, FiImage, FiLink2 } from "react-icons/fi";
import { BiPin } from "react-icons/bi";
import useSharedContent from "../../hooks/useSharedContent";
import usePinnedMessages from "../../hooks/usePinnedMessages";
import useMessageActions from "../../hooks/useMessageActions";
import { scrollToMessage } from "../../Utils/scrollToMessage";
import { getMessageBodyText } from "../../Utils/messageDisplay";
import MediaPreviewModal from "../common/MediaPreviewModal";
import type { Message, SharedDocumentItem, SharedLinkItem, SharedMediaItem } from "../../types";

type SectionKey = "pinned" | "media" | "links" | "documents";

const formatDate = (value: string): string => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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
  <div className="space-y-3 animate-pulse px-4 pb-4">
    <div className="h-24 rounded-xl bg-slate-200/70" />
    <div className="h-12 rounded-xl bg-slate-200/70" />
  </div>
);

interface AccordionRowProps {
  id: SectionKey;
  title: string;
  count: number;
  isOpen: boolean;
  onToggle: (section: SectionKey) => void;
  icon: ReactNode;
  children: ReactNode;
}

// A row within the shared grouped card, not its own bordered box — the
// parent supplies divide-y separators between rows.
const AccordionRow = ({ id, title, count, isOpen, onToggle, icon, children }: AccordionRowProps) => {
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(id)}
        className="flex w-full items-center gap-2.5 px-4 py-3 text-left transition-colors hover:bg-slate-50"
        aria-expanded={isOpen}
        aria-controls={`shared-content-${id}`}
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
          {icon}
        </span>
        <span className="flex-1 text-sm font-medium text-slate-800">{title}</span>
        <span className="text-xs font-medium text-slate-400">{count}</span>
        <FiChevronDown
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          size={16}
        />
      </button>

      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            id={`shared-content-${id}`}
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
    </div>
  );
};

const MediaGrid = ({ items, onPreview }: { items: SharedMediaItem[]; onPreview: (item: SharedMediaItem) => void }) => {
  if (items.length === 0) return <p className="text-sm text-slate-500">No media shared yet.</p>;

  return (
    <div className="grid grid-cols-3 gap-2">
      {items.map((item) => (
        <button
          type="button"
          key={`${item.url}-${item.createdAt}`}
          onClick={() => onPreview(item)}
          className="relative aspect-square overflow-hidden rounded-xl focus:outline-none focus:ring-2 focus:ring-slate-400 group"
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
          <span className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/15" />
        </button>
      ))}
    </div>
  );
};

const LinksList = ({ links }: { links: SharedLinkItem[] }) => {
  if (links.length === 0) return <p className="text-sm text-slate-500">No links shared yet.</p>;

  return (
    <div className="space-y-2">
      {links.map((link) => (
        <a
          key={`${link.url}-${link.createdAt}`}
          href={link.url}
          target="_blank"
          rel="noreferrer"
          className="block rounded-xl border border-slate-200 bg-white px-3 py-2 transition-colors hover:bg-slate-50"
        >
          <p className="truncate text-sm font-medium text-slate-800">{link.title}</p>
          <div className="mt-1 flex items-center justify-between">
            <p className="truncate text-xs text-slate-500">{getDomain(link.url)}</p>
            <p className="text-xs text-slate-400">{formatDate(link.createdAt)}</p>
          </div>
        </a>
      ))}
    </div>
  );
};

const DocumentsList = ({ documents }: { documents: SharedDocumentItem[] }) => {
  if (documents.length === 0) return <p className="text-sm text-slate-500">No documents shared yet.</p>;

  return (
    <div className="space-y-2">
      {documents.map((document) => (
        <div
          key={`${document.url}-${document.createdAt}`}
          className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-600">
            <FiFileText />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-800">{document.name}</p>
            <p className="text-xs text-slate-500">
              {[formatFileSize(document.size), formatDate(document.createdAt)].filter(Boolean).join(" • ")}
            </p>
          </div>
          <a
            href={document.url}
            target="_blank"
            rel="noreferrer"
            download={document.name}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-700 transition-colors hover:bg-slate-50"
            aria-label={`Download ${document.name}`}
          >
            <FiDownload size={14} />
          </a>
        </div>
      ))}
    </div>
  );
};

const PinnedMessageRow = ({ message, onNavigate }: { message: Message; onNavigate: () => void }) => {
  const { togglePin } = useMessageActions(message);
  const snippet = message.deletedForEveryone ? null : getMessageBodyText(message) || "Media message";

  if (!snippet) return null;

  return (
    <div className="flex items-start gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
      <button
        type="button"
        onClick={() => {
          onNavigate();
          if (message._id) scrollToMessage(message._id);
        }}
        className="min-w-0 flex-1 text-left"
      >
        <p className="truncate text-sm text-slate-800">{snippet}</p>
        <p className="mt-0.5 text-xs text-slate-400">{formatDate(message.createdAt)}</p>
      </button>
      <button
        type="button"
        onClick={() => void togglePin(false)}
        aria-label="Unpin message"
        className="shrink-0 text-slate-400 transition-colors hover:text-rose-500"
      >
        <BiPin size={16} />
      </button>
    </div>
  );
};

interface SharedContentSectionProps {
  // Called before navigating to a pinned message — lets the drawer variant
  // close itself so the message thread becomes visible.
  onNavigateToMessage?: () => void;
}

// Unified "Content" grouped card: Pinned Messages, Shared Media, Shared
// Links, Shared Documents — one bordered card with row dividers, not
// separate spaced-apart boxes. Used by both UserDetailsPanel (direct) and
// GroupInfoPanel (group); the underlying hooks are conversation-scoped so
// this works identically for both.
const SharedContentSection = ({ onNavigateToMessage }: SharedContentSectionProps) => {
  const { details, loading, error, refetch } = useSharedContent();
  const { pinnedMessages } = usePinnedMessages();
  const [previewItem, setPreviewItem] = useState<SharedMediaItem | null>(null);
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    pinned: false,
    media: false,
    links: false,
    documents: false,
  });

  const toggleSection = (section: SectionKey) => {
    setOpenSections((previous) => ({ ...previous, [section]: !previous[section] }));
  };

  const mediaItems = details?.media || [];
  const linkItems = details?.links || [];
  const documentItems = details?.documents || [];

  return (
    <>
      <section className="divide-y divide-slate-100 overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <AccordionRow
          id="pinned"
          title="Pinned messages"
          count={pinnedMessages.length}
          isOpen={openSections.pinned}
          onToggle={toggleSection}
          icon={<BiPin size={15} />}
        >
          {pinnedMessages.length === 0 ? (
            <p className="text-sm text-slate-500">No pinned messages yet.</p>
          ) : (
            <div className="space-y-2">
              {pinnedMessages.map((message) => (
                <PinnedMessageRow
                  key={message._id}
                  message={message}
                  onNavigate={() => onNavigateToMessage?.()}
                />
              ))}
            </div>
          )}
        </AccordionRow>

        {loading ? (
          <SkeletonRows />
        ) : error ? (
          <div className="px-4 pb-4">
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
          </div>
        ) : (
          <>
            <AccordionRow
              id="media"
              title="Shared media"
              count={mediaItems.length}
              isOpen={openSections.media}
              onToggle={toggleSection}
              icon={<FiImage size={15} />}
            >
              <MediaGrid items={mediaItems} onPreview={setPreviewItem} />
            </AccordionRow>

            <AccordionRow
              id="links"
              title="Shared links"
              count={linkItems.length}
              isOpen={openSections.links}
              onToggle={toggleSection}
              icon={<FiLink2 size={15} />}
            >
              <LinksList links={linkItems} />
            </AccordionRow>

            <AccordionRow
              id="documents"
              title="Shared documents"
              count={documentItems.length}
              isOpen={openSections.documents}
              onToggle={toggleSection}
              icon={<FiFileText size={15} />}
            >
              <DocumentsList documents={documentItems} />
            </AccordionRow>
          </>
        )}
      </section>

      <MediaPreviewModal item={previewItem} onClose={() => setPreviewItem(null)} />
    </>
  );
};

export default SharedContentSection;
