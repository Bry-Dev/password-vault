import { describe, expect, it } from 'vitest'
import { describeBackupAge, BACKUP_STALE_AFTER_DAYS } from './backupAge'

// Dates are built from local components so the tests hold in every time zone.
const NOW = new Date(2026, 10, 13, 8, 0) // 13 Nov, 8:00 am local
const at = (day: number, hour: number) => new Date(2026, 10, day, hour, 0).toISOString()

describe('describeBackupAge', () => {
  it('flags a vault that was never exported', () => {
    expect(describeBackupAge(undefined, NOW)).toEqual({ label: 'No backup exported yet', stale: true })
  })

  it('describes a backup made earlier today', () => {
    expect(describeBackupAge(at(13, 1), NOW)).toEqual({ label: 'Last backup: today', stale: false })
  })

  it('uses calendar days: 11 pm last night is "yesterday", not "today"', () => {
    expect(describeBackupAge(at(12, 23), NOW)).toEqual({ label: 'Last backup: yesterday', stale: false })
  })

  it('counts calendar days for older backups', () => {
    expect(describeBackupAge(at(10, 23), NOW).label).toBe('Last backup: 3 days ago')
  })

  it('becomes stale after the threshold', () => {
    expect(describeBackupAge(at(13 - (BACKUP_STALE_AFTER_DAYS - 1), 12), NOW).stale).toBe(false)
    expect(describeBackupAge(at(13 - BACKUP_STALE_AFTER_DAYS, 12), NOW)).toEqual({
      label: `Last backup: ${BACKUP_STALE_AFTER_DAYS} days ago`,
      stale: true,
    })
  })

  it('treats an unreadable date as never exported', () => {
    expect(describeBackupAge('garbage', NOW).stale).toBe(true)
  })
})
