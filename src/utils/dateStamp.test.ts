import { describe, expect, it } from 'vitest'
import { localDateStamp } from './dateStamp'

describe('localDateStamp', () => {
  it("uses the device's local calendar date, not UTC", () => {
    // Built from local components, so this holds in every time zone.
    expect(localDateStamp(new Date(2026, 10, 13, 0, 30))).toBe('2026-11-13')
    expect(localDateStamp(new Date(2026, 10, 13, 23, 59))).toBe('2026-11-13')
  })

  it('zero-pads month and day', () => {
    expect(localDateStamp(new Date(2027, 0, 5, 12))).toBe('2027-01-05')
  })
})
