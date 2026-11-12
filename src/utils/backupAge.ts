export const BACKUP_STALE_AFTER_DAYS = 14

const DAY_MS = 86_400_000

export interface BackupAge {
  label: string
  stale: boolean
}

/** Midnight of the given moment's local calendar day, as a UTC-based day count (DST-safe). */
function localDayNumber(date: Date): number {
  return Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / DAY_MS
}

export function describeBackupAge(lastBackupAt: string | undefined, now: Date = new Date()): BackupAge {
  const time = lastBackupAt ? Date.parse(lastBackupAt) : NaN
  if (Number.isNaN(time)) return { label: 'No backup exported yet', stale: true }

  // Calendar days in the device's local time zone, so "yesterday" matches what the user sees.
  const days = Math.max(0, localDayNumber(now) - localDayNumber(new Date(time)))
  const label = days === 0 ? 'Last backup: today' : days === 1 ? 'Last backup: yesterday' : `Last backup: ${days} days ago`
  return { label, stale: days >= BACKUP_STALE_AFTER_DAYS }
}
