import { useState } from "react";
import { PiCaretDownBold } from "react-icons/pi";
import FadeIn from "../components/FadeIn";

const FAQ_ITEMS = [
  {
    question: "Can the server read my messages?",
    answer:
      "No. Content is encrypted on your device with AES-GCM before it's sent, and the AES key is itself wrapped with RSA-OAEP for each recipient. The server stores and forwards that ciphertext — it has no key that can open it.",
  },
  {
    question: "What happens if I lose my device?",
    answer:
      "If you enabled encrypted backup, you can restore your private key on a new device using your backup password — that password never leaves your browser. Without backup enabled, recovery relies on an already-approved device explicitly linking the new one.",
  },
  {
    question: "What if I lose my backup password and have no other device?",
    answer:
      "Then encrypted history on that account can't be recovered — this is the direct tradeoff of a zero-knowledge design. There's no support-desk override, because there's no one who holds the key but you.",
  },
  {
    question: "Does adding someone to a group expose past messages?",
    answer:
      "No. Each message is sealed only for the members present at the time it was sent, so a new member's client simply has no key for anything before they joined.",
  },
  {
    question: "What about someone I remove from a group?",
    answer:
      "They immediately lose the ability to send or receive new messages. The honest caveat: they can still decrypt whatever they already had a key for before removal. Re-keying a group's entire history on every removal is a real feature — it's just not built yet.",
  },
  {
    question: "Is this open source?",
    answer: "Yes — the full source, including the encryption implementation, is available on GitHub.",
  },
];

const FaqItem = ({ question, answer }: { question: string; answer: string }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="border-b border-slate-100 py-5">
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        className="flex w-full items-center justify-between gap-4 text-left"
      >
        <span className="text-[15px] font-semibold text-ink">{question}</span>
        <PiCaretDownBold
          className={`shrink-0 text-slate-400 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
          size={16}
        />
      </button>
      <div
        className="grid overflow-hidden transition-all duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="min-h-0">
          <p className="pt-3 text-sm leading-relaxed text-slate-500">{answer}</p>
        </div>
      </div>
    </div>
  );
};

const Faq = () => (
  <section id="faq" className="mx-auto max-w-landing px-5 py-20 sm:px-8 sm:py-28">
    <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-16">
      <FadeIn>
        <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">FAQ</span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-[2.25rem]">
          Straight answers about the encryption
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-slate-500">
          Zero-knowledge encryption is a real tradeoff, not just a feature —
          here&apos;s exactly what it means in practice.
        </p>
      </FadeIn>

      <FadeIn delay={0.1}>
        {FAQ_ITEMS.map((item) => (
          <FaqItem key={item.question} question={item.question} answer={item.answer} />
        ))}
      </FadeIn>
    </div>
  </section>
);

export default Faq;
