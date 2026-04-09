// Format timestamps for the chat UI using local time and a fixed HH:MM display.
export function extractTime(dateString: string): string {
	const date = new Date(dateString);
	const hours = padZero(date.getHours());
	const minutes = padZero(date.getMinutes());
	return `${hours}:${minutes}`;
}

// Keep single-digit values aligned with the rest of the timeline formatting.
function padZero(number: number): string {
	return number.toString().padStart(2, "0");
}