import type { ReactNode } from "react";

/**
 * Matches URLs in plain text — handles http(s)://, www., and bare domain patterns.
 * Intentionally permissive so common links shared in chat get detected.
 */
const URL_REGEX =
  /(?:https?:\/\/|www\.)[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&/=]*)/gi;

/**
 * Takes a plain-text message and returns an array of React nodes where
 * URL substrings are replaced by clickable `<a>` elements.
 *
 * Non-URL segments are returned as raw strings so React can render them
 * as text nodes without extra wrapper elements.
 */
export const linkifyText = (text: string): ReactNode[] => {
  const parts: ReactNode[] = [];
  let lastIndex = 0;

  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0];
    const start = match.index!;

    // Push the text before this URL.
    if (start > lastIndex) {
      parts.push(text.slice(lastIndex, start));
    }

    // Ensure the href has a protocol so the browser doesn't treat it as relative.
    const href = url.startsWith("http") ? url : `https://${url}`;

    parts.push(
      <a
        key={`${start}-${url}`}
        href={href}
        target="_self"
        rel="noopener noreferrer"
        className="underline underline-offset-2 break-all hover:opacity-80 transition-opacity"
      >
        {url}
      </a>
    );

    lastIndex = start + url.length;
  }

  // Push any remaining text after the last URL.
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts.length > 0 ? parts : [text];
};
