import { PiCopy, PiCrownSimpleFill, PiLinkSimpleBold } from "react-icons/pi";
import FeatureDeepDive from "./FeatureDeepDive";

const MEMBER_INITIALS = ["A", "M", "J", "R"];

const GroupChatVisual = () => (
  <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_24px_48px_-24px_rgba(27,16,53,0.18)]">
    <div className="flex items-center justify-between">
      <p className="text-sm font-semibold text-ink">Weekend Trip · 4 members</p>
      <span className="rounded-full bg-brand-50 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-brand-600">
        Group
      </span>
    </div>

    <div className="mt-4 space-y-2">
      {MEMBER_INITIALS.map((initial, index) => (
        <div key={initial} className="flex items-center gap-3 rounded-xl px-2 py-1.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-ink">
            {initial}
          </div>
          <span className="text-[13px] text-ink">Member {index + 1}</span>
          {index === 0 && (
            <span className="ml-auto flex items-center gap-1 text-[10px] font-semibold text-mint-dark">
              <PiCrownSimpleFill size={12} />
              Admin
            </span>
          )}
        </div>
      ))}
    </div>

    <div className="mt-5 flex items-center gap-2 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-3.5 py-3">
      <PiLinkSimpleBold className="shrink-0 text-brand-500" size={16} />
      <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-400">
        /join/8fQ2s7K2n...
      </span>
      <PiCopy className="shrink-0 text-slate-400" size={15} />
    </div>
  </div>
);

const GroupChatSection = () => (
  <FeatureDeepDive
    eyebrow="Group chat"
    title="Groups without a shared secret"
    body="There's no single group key to leak. Every message gets a fresh encryption key that's individually sealed for each current member — so growing a group never means re-securing its entire history. Add people directly or drop a join link in any chat."
    checklist={["Admins & member management", "Shareable invite links", "Same end-to-end encryption as a 1:1 chat"]}
    visual={<GroupChatVisual />}
    reverse
  />
);

export default GroupChatSection;
