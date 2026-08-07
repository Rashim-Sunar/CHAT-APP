import { Link } from "react-router-dom";
import { PiGithubLogoBold } from "react-icons/pi";
import Logo from "../components/Logo";

const LandingFooter = () => (
  <footer className="border-t border-slate-100 bg-white">
    <div className="mx-auto max-w-landing px-5 py-14 sm:px-8">
      <div className="grid gap-10 sm:grid-cols-[1.4fr_1fr_1fr]">
        <div>
          <Logo />
          <p className="mt-3 max-w-xs text-sm leading-relaxed text-slate-400">
            A real-time chat app built around hybrid end-to-end encryption —
            personal and group messaging, with a server that&apos;s designed to
            never see your plaintext.
          </p>
          <a
            href="https://github.com/Rashim-Sunar/CHAT-APP"
            target="_blank"
            rel="noreferrer"
            className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-ink"
          >
            <PiGithubLogoBold size={16} />
            View source on GitHub
          </a>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Product</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <a href="#security" className="text-slate-500 transition-colors hover:text-ink">
                Security
              </a>
            </li>
            <li>
              <a href="#how-it-works" className="text-slate-500 transition-colors hover:text-ink">
                How it works
              </a>
            </li>
            <li>
              <a href="#faq" className="text-slate-500 transition-colors hover:text-ink">
                FAQ
              </a>
            </li>
          </ul>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">Account</p>
          <ul className="mt-4 space-y-2.5 text-sm">
            <li>
              <Link to="/signup" className="text-slate-500 transition-colors hover:text-ink">
                Create account
              </Link>
            </li>
            <li>
              <Link to="/login" className="text-slate-500 transition-colors hover:text-ink">
                Sign in
              </Link>
            </li>
          </ul>
        </div>
      </div>

      <div className="mt-12 flex flex-col gap-2 border-t border-slate-100 pt-6 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
        <p>&copy; {new Date().getFullYear()} ChatApp. Built by Rashim Sunar.</p>
        <p>No ads. No message scanning.</p>
      </div>
    </div>
  </footer>
);

export default LandingFooter;
