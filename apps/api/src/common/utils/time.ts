/**
 * Get formatted calendar date (YYYY-MM-DD) for a given Date in a specific IANA timezone.
 */
export function getCalendarDateString(date: Date, timezone = 'Asia/Jakarta'): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
  } catch {
    // Fallback to UTC if timezone is invalid
    return date.toISOString().split('T')[0];
  }
}

/**
 * Get formatted local time (HH:mm) for a given Date in a specific IANA timezone.
 */
export function getLocalTimeString(date: Date, timezone = 'Asia/Jakarta'): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(date);
  } catch {
    // Fallback to UTC HH:mm
    const hours = String(date.getUTCHours()).padStart(2, '0');
    const minutes = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }
}

/**
 * Parse HH:mm string to minutes of the day (0 - 1439).
 */
export function parseMinutesOfDay(timeStr: string): number {
  const parts = timeStr.split(':').map((s) => parseInt(s, 10));
  const hours = isNaN(parts[0]) ? 0 : parts[0];
  const minutes = isNaN(parts[1]) ? 0 : parts[1];
  return hours * 60 + minutes;
}

/**
 * Determine if a check-in is late based on shift start time and grace period.
 *
 * @param checkInTimeStr "HH:mm" local check-in time
 * @param shiftStartTimeStr "HH:mm" shift scheduled start
 * @param gracePeriodMinutes allowable minutes after start before marked late
 */
export function isCheckInLate(
  checkInTimeStr: string,
  shiftStartTimeStr: string,
  gracePeriodMinutes: number
): boolean {
  const checkInMins = parseMinutesOfDay(checkInTimeStr);
  const shiftStartMins = parseMinutesOfDay(shiftStartTimeStr);
  const allowableThreshold = shiftStartMins + gracePeriodMinutes;

  return checkInMins > allowableThreshold;
}
