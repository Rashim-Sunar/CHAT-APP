import type { ReactNode } from "react";
import { PiCheckBold } from "react-icons/pi";
import FadeIn from "../components/FadeIn";

interface FeatureDeepDiveProps {
  id?: string;
  eyebrow: string;
  title: string;
  body: string;
  checklist: string[];
  visual: ReactNode;
  reverse?: boolean;
}

const FeatureDeepDive = ({ id, eyebrow, title, body, checklist, visual, reverse = false }: FeatureDeepDiveProps) => {
  return (
    <section id={id} className="mx-auto max-w-landing px-5 py-16 sm:px-8 sm:py-20">
      <div className="grid items-center gap-12 lg:grid-cols-2 lg:gap-16">
        <FadeIn className={reverse ? "lg:order-2" : "lg:order-1"}>{visual}</FadeIn>

        <FadeIn delay={0.1} className={reverse ? "lg:order-1" : "lg:order-2"}>
          <span className="text-xs font-semibold uppercase tracking-wider text-brand-600">{eyebrow}</span>
          <h2 className="mt-3 font-display text-3xl font-bold leading-tight tracking-tight text-ink sm:text-[2.25rem]">
            {title}
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-slate-500 sm:text-base">{body}</p>

          <ul className="mt-6 space-y-3">
            {checklist.map((item) => (
              <li key={item} className="flex items-start gap-2.5 text-[15px] text-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-mint/15 text-mint-dark">
                  <PiCheckBold size={11} />
                </span>
                {item}
              </li>
            ))}
          </ul>
        </FadeIn>
      </div>
    </section>
  );
};

export default FeatureDeepDive;
