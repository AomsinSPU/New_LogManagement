export function formatDate(value) {
  if (!value || Number.isNaN(Date.parse(value))) return '—'
  return new Intl.DateTimeFormat('th-TH-u-ca-gregory-nu-latn', { timeZone: 'Asia/Bangkok', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }).format(new Date(value))
}
export function toApiTime(value) { return value ? new Date(`${value}+07:00`).toISOString() : '' }
export function toThaiInput(value) {
  if (!value || Number.isNaN(Date.parse(value))) return ''
  return new Date(Date.parse(value) + 7 * 3600000).toISOString().slice(0, 16)
}