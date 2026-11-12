/** YYYY-MM-DD in the device's local time zone (toISOString() would give the UTC date). */
export function localDateStamp(date: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}
