import { PiLockSimpleFill, PiLightningFill, PiUsersThreeFill } from "react-icons/pi";
import FadeIn from "../components/FadeIn";

const PILLARS = [
  {
    icon: PiLockSimpleFill,
    title: "Locked to your devices",
    body: "Content is encrypted before it leaves your device. The server stores and relays ciphertext — it's structurally unable to decrypt a message, not just policy-bound not to.",
  },
  {
    icon: PiLightningFill,
    title: "Instant, everywhere you're signed in",
    body: "Delivery, presence, and read receipts over a live socket connection — plus device linking, so adding a second device doesn't mean weakening the encryption to make it work.",
  },
  {
    icon: PiUsersThreeFill,
    title: "Groups, not an afterthought",
    body: "A group conversation gets the exact same encryption model as a 1:1 — every message individually sealed for every current member, no shared key to compromise.",
  },
];

const Pillars = () => {
  return (
    <section className="mx-auto max-w-landing px-5 py-20 sm:px-8 sm:py-28">
      <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">Why it&apos;s different</span>
      <h2 className="mt-3 max-w-2xl font-display text-3xl font-bold tracking-tight text-ink sm:text-[2.25rem]">
        Encryption that doesn&apos;t get weaker at the edges
      </h2>

      <div className="mt-12 grid gap-10 sm:grid-cols-3 sm:gap-8">
        {PILLARS.map((pillar, index) => (
          <FadeIn key={pillar.title} delay={index * 0.08}>
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-brand-50 text-brand-600">
              <pillar.icon size={20} />
            </div>
            <h3 className="mt-5 font-display text-xl font-semibold text-ink">{pillar.title}</h3>
            <p className="mt-2.5 text-[15px] leading-relaxed text-slate-500">{pillar.body}</p>
          </FadeIn>
        ))}
      </div>
    </section>
  );
};

export default Pillars;
