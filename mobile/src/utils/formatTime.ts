const pad = (value: number): string => String(value).padStart(2, "0");

const isSameDay = (a: Date, b: Date): boolean =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const formatClockTime = (iso: string): string => {
  const date = new Date(iso);
  const hours24 = date.getHours();
  const hours = hours24 % 12 || 12;
  const suffix = hours24 >= 12 ? "PM" : "AM";
  return `${hours}:${pad(date.getMinutes())} ${suffix}`;
};

// Sidebar-style relative stamp: clock time for today, "Yesterday", else a
// short date (with year only if not the current year).
export const formatRelativeTime = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();

  if (isSameDay(date, now)) return formatClockTime(iso);

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { month: "short", day: "numeric" } : { month: "short", day: "numeric", year: "numeric" });
};

// Chat date-separator label ("Today" / "Yesterday" / full date).
export const formatDateSeparator = (iso: string): string => {
  const date = new Date(iso);
  const now = new Date();

  if (isSameDay(date, now)) return "Today";

  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (isSameDay(date, yesterday)) return "Yesterday";

  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { month: "long", day: "numeric" } : { month: "long", day: "numeric", year: "numeric" });
};
