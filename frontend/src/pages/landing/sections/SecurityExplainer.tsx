import { PiArrowRight, PiDeviceMobileFill, PiLockKeyFill, PiPencilSimpleFill } from "react-icons/pi";
import FadeIn from "../components/FadeIn";

const STEPS = [
  {
    icon: PiPencilSimpleFill,
    title: "You write a message",
    body: "A fresh AES-256-GCM key is generated for that message alone, and used to encrypt the text on your device.",
  },
  {
    icon: PiLockKeyFill,
    title: "The key is sealed per recipient",
    body: "That AES key is wrapped with RSA-OAEP, once for every current participant — including yourself, so you can still read your own sent messages later.",
  },
  {
    icon: PiDeviceMobileFill,
    title: "Only their devices can open it",
    body: "The server stores and forwards the ciphertext as an opaque blob. Each recipient's private key — generated on their device and never uploaded — unwraps and decrypts it locally.",
  },
];

const SecurityExplainer = () => (
  <section id="security" className="relative overflow-hidden bg-gradient-to-b from-ink to-ink-light py-24 sm:py-28">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute left-1/2 top-0 h-[500px] w-[900px] -translate-x-1/2 rounded-full bg-brand-500/10 blur-[120px]"
    />

    <div className="relative mx-auto max-w-landing px-5 sm:px-8">
      <FadeIn className="mx-auto max-w-2xl text-center">
        <span className="text-xs font-semibold uppercase tracking-wider text-mint">How the encryption works</span>
        <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-white sm:text-[2.25rem]">
          The server only ever sees ciphertext
        </h2>
        <p className="mt-4 text-[15px] leading-relaxed text-white/60">
          A hybrid model — AES-GCM for speed, RSA-OAEP for key exchange —
          applied exactly the same way whether you&apos;re messaging one person
          or a group of fifty. No separate, weaker path for groups.
        </p>
      </FadeIn>

      <div className="mt-16 grid gap-8 lg:grid-cols-3 lg:gap-6">
        {STEPS.map((step, index) => (
          <FadeIn key={step.title} delay={index * 0.1} className="relative">
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-6">
              <span className="font-mono text-xs text-mint">0{index + 1}</span>
              <div className="mt-4 flex h-11 w-11 items-center justify-center rounded-xl bg-white/10 text-mint">
                <step.icon size={20} />
              </div>
              <h3 className="mt-4 text-base font-semibold text-white">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-white/55">{step.body}</p>
            </div>

            {index < STEPS.length - 1 && (
              <PiArrowRight
                aria-hidden="true"
                className="absolute -right-3 top-1/2 hidden -translate-y-1/2 text-white/20 lg:block"
                size={20}
              />
            )}
          </FadeIn>
        ))}
      </div>

      <FadeIn delay={0.3} className="mx-auto mt-14 max-w-2xl rounded-2xl border border-white/10 bg-white/[0.03] px-6 py-5 text-center">
        <p className="text-sm text-white/60">
          Signing in on a new device doesn&apos;t skip this — it either restores your
          key from a locally-encrypted, password-protected backup, or asks an
          already-trusted device to approve it. Chat access stays gated until
          the device actually has the key to decrypt.
        </p>
      </FadeIn>
    </div>
  </section>
);

export default SecurityExplainer;
