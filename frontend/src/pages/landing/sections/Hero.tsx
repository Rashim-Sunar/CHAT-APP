import { Link } from "react-router-dom";
import { PiArrowRight } from "react-icons/pi";
import { motion, useReducedMotion } from "framer-motion";
import ChatMockup from "../components/ChatMockup";

const Hero = () => {
  const prefersReducedMotion = useReducedMotion();

  return (
    <section className="relative overflow-hidden pb-20 pt-40 sm:pt-48">
      {/* Soft decorative gradient orbs instead of stock illustration */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -left-40 -top-40 h-[420px] w-[420px] rounded-full bg-brand-400/20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -right-32 top-20 h-[380px] w-[380px] rounded-full bg-mint/15 blur-3xl"
      />

      <div className="relative mx-auto grid max-w-landing items-center gap-16 px-5 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:gap-10">
        <div className="max-w-xl">
          <motion.span
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 rounded-full border border-brand-100 bg-brand-50 px-3.5 py-1.5 text-xs font-semibold uppercase tracking-wider text-brand-600"
          >
            End-to-end encrypted
          </motion.span>

          <motion.h1
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.05 }}
            className="mt-5 font-display text-[2.5rem] font-bold leading-[1.08] tracking-tight text-ink sm:text-5xl lg:text-[3.4rem]"
          >
            Private conversations. Including the group ones.
          </motion.h1>

          <motion.p
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="mt-5 text-lg leading-relaxed text-slate-500"
          >
            Every message is sealed on your device before it&apos;s sent. Not
            &ldquo;encrypted in transit,&rdquo; not obscured for later
            analytics — genuinely unreadable to anyone outside the
            conversation. Us included.
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15 }}
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
          >
            <Link
              to="/signup"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-brand-500 px-6 py-3.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition-all hover:-translate-y-0.5 hover:bg-brand-600 hover:shadow-xl hover:shadow-brand-500/30"
            >
              Create an account
              <PiArrowRight className="transition-transform group-hover:translate-x-0.5" size={16} />
            </Link>
            <Link
              to="/login"
              className="inline-flex items-center justify-center rounded-full border border-slate-200 px-6 py-3.5 text-sm font-semibold text-ink transition-colors hover:border-slate-300 hover:bg-slate-50"
            >
              Sign in
            </Link>
          </motion.div>

          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.6, delay: 0.25 }}
            className="mt-4 text-xs font-medium text-slate-400"
          >
            No ads, no message scanning · Source available on GitHub
          </motion.p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: prefersReducedMotion ? 0 : 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2 }}
        >
          <ChatMockup />
        </motion.div>
      </div>
    </section>
  );
};

export default Hero;
