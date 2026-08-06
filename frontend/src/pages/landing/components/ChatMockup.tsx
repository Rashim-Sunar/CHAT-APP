import { PiLockSimpleFill, PiPaperPlaneTiltFill, PiUsersThreeFill } from "react-icons/pi";

/**
 * Hand-built (not a screenshot) mockup of a group conversation for the hero
 * visual — a real screenshot would date quickly and can't be captured here,
 * but a purpose-built mockup reads more intentional than a stock image.
 */
const ChatMockup = () => {
  return (
    <div className="relative mx-auto w-full max-w-[420px] rotate-1 rounded-[28px] border border-white/10 bg-white shadow-[0_40px_80px_-20px_rgba(27,16,53,0.45)] sm:rotate-2">
      <div className="flex items-center gap-3 rounded-t-[28px] border-b border-slate-100 bg-white px-5 py-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-mint/15 text-mint-dark">
          <PiUsersThreeFill size={20} />
        </div>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-ink">Weekend Trip</p>
          <p className="text-xs text-slate-400">4 members · encrypted</p>
        </div>
        <span className="ml-auto flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-brand-600">
          <PiLockSimpleFill size={13} />
        </span>
      </div>

      <div className="space-y-3 px-5 py-5">
        <div className="flex items-end gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-100 text-[11px] font-semibold text-brand-600">
            A
          </div>
          <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-[13px] leading-snug text-ink">
            Just sent the cabin address 🏡
          </div>
        </div>

        <div className="flex items-end gap-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-mint/20 text-[11px] font-semibold text-mint-dark">
            M
          </div>
          <div className="max-w-[75%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-[13px] leading-snug text-ink">
            Perfect, see you all Friday
          </div>
        </div>

        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-2xl rounded-br-sm bg-brand-500 px-3.5 py-2.5 text-[13px] leading-snug text-white">
            Can&apos;t wait — bringing the good coffee ☕
          </div>
        </div>

        <div className="flex justify-center pt-1">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-mint/10 px-3 py-1 text-[11px] font-medium text-mint-dark">
            <PiLockSimpleFill size={11} />
            Only your devices hold the keys
          </span>
        </div>
      </div>

      <div className="flex items-center gap-2.5 rounded-b-[28px] border-t border-slate-100 bg-white px-5 py-3.5">
        <div className="h-9 flex-1 rounded-full bg-slate-100" aria-hidden="true" />
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-500 text-white">
          <PiPaperPlaneTiltFill size={15} />
        </div>
      </div>
    </div>
  );
};

export default ChatMockup;
