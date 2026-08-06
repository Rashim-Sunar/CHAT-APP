import FadeIn from "../components/FadeIn";

const STEPS = [
  {
    number: "01",
    title: "Create an account",
    body: "An RSA key pair generates on your device the moment you sign up. The private half never leaves it.",
  },
  {
    number: "02",
    title: "Start chatting",
    body: "Message someone directly, or spin up a group — both use the same end-to-end encrypted send path.",
  },
  {
    number: "03",
    title: "Invite people",
    body: "Add members to a group directly, or share a join link in any chat — recipients only see history from the moment they join.",
  },
  {
    number: "04",
    title: "Stay in sync",
    body: "Link a new device with an already-approved one, or restore instantly from an encrypted, password-protected backup.",
  },
];

const HowItWorks = () => (
  <section id="how-it-works" className="mx-auto max-w-landing px-5 py-20 sm:px-8 sm:py-28">
    <FadeIn className="max-w-xl">
      <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">How it works</span>
      <h2 className="mt-3 font-display text-3xl font-bold tracking-tight text-ink sm:text-[2.25rem]">
        From sign-up to your first encrypted message
      </h2>
    </FadeIn>

    <div className="mt-14 grid gap-x-6 gap-y-12 sm:grid-cols-2 lg:grid-cols-4">
      {STEPS.map((step, index) => (
        <FadeIn key={step.number} delay={index * 0.08} className="relative">
          <span className="font-display text-5xl font-bold text-slate-100" aria-hidden="true">
            {step.number}
          </span>
          <h3 className="mt-1 text-base font-semibold text-ink">{step.title}</h3>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{step.body}</p>
        </FadeIn>
      ))}
    </div>
  </section>
);

export default HowItWorks;
