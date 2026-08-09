export type ConversationFilterKey = "all" | "people" | "unread" | "groups";

const FILTERS: { key: ConversationFilterKey; label: string }[] = [
  { key: "all", label: "All" },
  { key: "people", label: "People" },
  { key: "unread", label: "Unread" },
  { key: "groups", label: "Groups" },
];

interface ConversationFilterTabsProps {
  active: ConversationFilterKey;
  onChange: (filter: ConversationFilterKey) => void;
}

const ConversationFilterTabs = ({ active, onChange }: ConversationFilterTabsProps) => {
  return (
    <div className="flex items-center gap-1" role="tablist" aria-label="Filter chats">
      {FILTERS.map((filter) => {
        const isActive = filter.key === active;

        return (
          <button
            key={filter.key}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(filter.key)}
            className={`shrink-0 rounded-full px-2 py-1 text-sm transition-colors ${
              isActive ? "bg-slate-100 font-semibold text-slate-800" : "font-normal text-slate-500 hover:text-slate-700"
            }`}
          >
            {filter.label}
          </button>
        );
      })}
    </div>
  );
};

export default ConversationFilterTabs;
