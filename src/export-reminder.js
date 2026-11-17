// Saves live only in this browser, so remind the player to export a backup now and then.
export const EXPORT_DAY_KEY = 'jetrise.lastExportDay';
export const REMINDER_INTERVAL_DAYS = 7;

const readDay = (storage, key) => {
  try {
    const value = Number(storage.getItem(key));
    return Number.isInteger(value) && value > 0 ? value : 0;
  } catch {
    return 0;
  }
};

export function markExported(storage, day) {
  try {
    storage.setItem(EXPORT_DAY_KEY, String(day));
  } catch {
    // Reminders are best effort; a full or blocked storage must not break exporting.
  }
}

// True when a backup is overdue and the player has not already been reminded today.
// The first reminder waits one full interval after day 1; the player is never nagged more than once per interval.
export function exportReminderDue(storage, day, remindedDay = 0) {
  const lastExport = readDay(storage, EXPORT_DAY_KEY);
  const since = day - Math.max(lastExport, remindedDay);
  return day > REMINDER_INTERVAL_DAYS && since >= REMINDER_INTERVAL_DAYS;
}
