interface LogoProps {
  size?: number;
  withWordmark?: boolean;
  tone?: "light" | "dark";
}

/**
 * Custom mark: a message-bubble badge with a keyhole cut from it — the
 * literal shape of "a conversation you need a key to open," rather than a
 * generic chat-bubble glyph.
 */
const Logo = ({ size = 32, withWordmark = true, tone = "dark" }: LogoProps) => {
  const textColor = tone === "dark" ? "text-ink" : "text-white";

  return (
    <span className="inline-flex items-center gap-2.5">
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none" aria-hidden="true">
        <rect width="32" height="32" rx="9" fill="#5B4FE9" />
        <path
          d="M9 12.5C9 10.567 10.567 9 12.5 9h7C21.433 9 23 10.567 23 12.5v5c0 1.933-1.567 3.5-3.5 3.5h-5.6L10 24v-3.2A3.5 3.5 0 0 1 9 18.1v-5.6Z"
          fill="white"
        />
        <circle cx="16" cy="14.6" r="1.9" fill="#5B4FE9" />
        <path d="M16 16.2v2.4" stroke="#5B4FE9" strokeWidth="1.6" strokeLinecap="round" />
      </svg>
      {withWordmark && (
        <span className={`font-display text-[1.15rem] font-semibold tracking-tight ${textColor}`}>
          ChatApp
        </span>
      )}
    </span>
  );
};

export default Logo;
