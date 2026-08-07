import { PiChecksBold, PiCircleFill } from "react-icons/pi";
import FeatureDeepDive from "./FeatureDeepDive";

const PersonalChatVisual = () => (
  <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-[0_24px_48px_-24px_rgba(27,16,53,0.18)]">
    <div className="flex items-center gap-3">
      <div className="relative">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-600">
          J
        </div>
        <span className="absolute -bottom-0.5 -right-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-white">
          <PiCircleFill className="text-mint" size={10} />
        </span>
      </div>
      <div>
        <p className="text-sm font-semibold text-ink">Jordan</p>
        <p className="text-xs text-mint-dark">Online</p>
      </div>
    </div>

    <div className="mt-5 space-y-2.5">
      <div className="flex justify-end">
        <div className="max-w-[80%] rounded-2xl rounded-br-sm bg-brand-500 px-3.5 py-2.5 text-[13px] text-white">
          Are you free for a call later?
        </div>
      </div>
      <div className="flex justify-end">
        <div className="flex items-center gap-1 pr-1 text-[10px] text-slate-400">
          Seen
          <PiChecksBold className="text-brand-500" size={12} />
        </div>
      </div>
      <div className="flex">
        <div className="max-w-[80%] rounded-2xl rounded-bl-sm bg-slate-100 px-3.5 py-2.5 text-[13px] text-ink">
          Yeah, anytime after 6 works
        </div>
      </div>
    </div>
  </div>
);

const PersonalChatSection = () => (
  <FeatureDeepDive
    eyebrow="Personal chat"
    title="One-to-one, instantly"
    body="Direct messages deliver in real time over a persistent socket connection, with live presence and read receipts. Edit or delete a message for yourself or for everyone — the choice is always yours, and it stays encrypted either way."
    checklist={["Instant delivery & online presence", "Read receipts", "Edit or delete — for yourself, or for everyone"]}
    visual={<PersonalChatVisual />}
  />
);

export default PersonalChatSection;
