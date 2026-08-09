// Shared date/time formatting for the sidebar list and message-thread dividers.
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const startOfDay = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), date.getDate());

const dayDiffFromToday = (date: Date): number =>
  Math.round((startOfDay(new Date()).getTime() - startOfDay(date).getTime()) / MS_PER_DAY);

const formatClockTime = (date: Date): string => {
  const hours = date.getHours().toString().padStart(2, "0");
  const minutes = date.getMinutes().toString().padStart(2, "0");
  return `${hours}:${minutes}`;
};

export const isSameDay = (a?: string, b?: string): boolean => {
  if (!a || !b) return false;
  const dateA = new Date(a);
  const dateB = new Date(b);
  if (Number.isNaN(dateA.getTime()) || Number.isNaN(dateB.getTime())) return false;
  return startOfDay(dateA).getTime() === startOfDay(dateB).getTime();
};

// e.g. "14:54" today, "Yesterday", a weekday within the week, else a short date.
export const formatConversationTimestamp = (dateString?: string): string => {
  if (!dateString) return "";
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const dayDiff = dayDiffFromToday(date);
  if (dayDiff <= 0) return formatClockTime(date);
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff < 7) return date.toLocaleDateString(undefined, { weekday: "short" });
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
};

// e.g. "Today" / "Yesterday" / weekday / full date.
export const formatDateDivider = (dateString: string): string => {
  const date = new Date(dateString);
  if (Number.isNaN(date.getTime())) return "";

  const dayDiff = dayDiffFromToday(date);
  if (dayDiff === 0) return "Today";
  if (dayDiff === 1) return "Yesterday";
  if (dayDiff > 1 && dayDiff < 7) return date.toLocaleDateString(undefined, { weekday: "long" });

  const isCurrentYear = date.getFullYear() === new Date().getFullYear();
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "long",
    year: isCurrentYear ? undefined : "numeric",
  });
};
