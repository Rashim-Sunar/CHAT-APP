import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { PiList, PiMoon, PiSun, PiX } from "react-icons/pi";
import Logo from "../components/Logo";
import { useTheme } from "../../../context/useTheme";

const NAV_LINKS = [
  { label: "Security", href: "#security" },
  { label: "How it works", href: "#how-it-works" },
  { label: "FAQ", href: "#faq" },
];

const LandingNav = () => {
  const [scrolled, setScrolled] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled ? "border-b border-slate-200/70 bg-white/80 backdrop-blur-md" : "border-b border-transparent bg-transparent"
      }`}
    >
      <div className="mx-auto flex h-[72px] max-w-landing items-center justify-between px-5 sm:px-8">
        <Link to="/" onClick={() => setMobileOpen(false)}>
          <Logo />
        </Link>

        <nav className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="text-sm font-medium text-slate-600 transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-4 md:flex">
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            title={theme === "dark" ? "Switch to light theme" : "Switch to dark theme"}
            className="flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 text-slate-600 transition-colors hover:border-brand-300 hover:bg-brand-50 hover:text-brand-600"
          >
            {theme === "dark" ? <PiSun size={17} /> : <PiMoon size={17} />}
          </button>
          <Link to="/login" className="text-sm font-medium text-slate-600 transition-colors hover:text-ink">
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-full bg-brand-500 px-4 py-2 text-sm font-semibold text-white shadow-sm shadow-brand-500/25 transition-all hover:-translate-y-px hover:bg-brand-600 hover:shadow-md hover:shadow-brand-500/30"
          >
            Create account
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          className="flex h-10 w-10 items-center justify-center rounded-lg text-ink md:hidden"
        >
          {mobileOpen ? <PiX size={22} /> : <PiList size={22} />}
        </button>
      </div>

      {mobileOpen && (
        <div className="border-t border-slate-200 bg-white px-5 py-4 md:hidden">
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map((link) => (
              <a
                key={link.href}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-ink"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3">
            <button
              type="button"
              onClick={toggleTheme}
              className="flex items-center justify-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 hover:text-ink"
            >
              {theme === "dark" ? <PiSun size={17} /> : <PiMoon size={17} />}
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </button>
            <Link
              to="/login"
              onClick={() => setMobileOpen(false)}
              className="rounded-lg px-3 py-2.5 text-center text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              Log in
            </Link>
            <Link
              to="/signup"
              onClick={() => setMobileOpen(false)}
              className="rounded-full bg-brand-500 px-4 py-2.5 text-center text-sm font-semibold text-white"
            >
              Create account
            </Link>
          </div>
        </div>
      )}
    </header>
  );
};

export default LandingNav;
