import { Link } from "react-router-dom";
import { PiArrowRight } from "react-icons/pi";
import FadeIn from "../components/FadeIn";

const FinalCta = () => (
  <section className="relative overflow-hidden bg-brand-500 py-20 sm:py-24">
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.12),_transparent_60%)]"
    />
    <FadeIn className="relative mx-auto max-w-xl px-5 text-center sm:px-8">
      <h2 className="font-display text-3xl font-bold tracking-tight text-white sm:text-4xl">
        Start a private conversation
      </h2>
      <p className="mt-3 text-[15px] text-white/75">
        Takes about a minute to set up. Your keys never leave your device.
      </p>
      <Link
        to="/signup"
        className="group mt-7 inline-flex items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-semibold text-brand-600 shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl"
      >
        Create an account
        <PiArrowRight className="transition-transform group-hover:translate-x-0.5" size={16} />
      </Link>
    </FadeIn>
  </section>
);

export default FinalCta;
