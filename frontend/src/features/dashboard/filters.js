const DAY = 86400000
export function defaultRange(now = Date.now()) {
  const end = Math.floor(now / 60000) * 60000
  return { from: new Date(end - DAY).toISOString(), to: new Date(end).toISOString() }
}
export function dashboardFilters(query, fallback) {
  const params = new URLSearchParams(query)
  const from = params.get('from') || fallback.from, to = params.get('to') || fallback.to
  const duration = Date.parse(to) - Date.parse(from)
  if (!Number.isFinite(duration) || duration <= 0 || duration > 90 * DAY) throw new Error('เลือกช่วงเวลามากกว่า 0 และไม่เกิน 90 วัน')
  const filters = new URLSearchParams({ from: new Date(from).toISOString(), to: new Date(to).toISOString() })
  for (const key of ['source', 'src_ip', 'dst_ip', 'user', 'event_type', 'outcome', 'severity', 'q', 'batch_id']) {
    if (params.get(key)) filters.set(key, params.get(key))
  }
  const interval = duration <= 12 * 3600000 ? 'minute' : duration <= 30 * DAY ? 'hour' : 'day'
  return { filters, interval }
}
export function logsLink(filters, additions = {}) {
  const params = new URLSearchParams(filters)
  for (const [key, value] of Object.entries(additions)) params.set(key, value)
  return '#/logs?' + params.toString()
}