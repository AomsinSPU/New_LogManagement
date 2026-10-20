export const statuses = { open: 'เปิดอยู่', acknowledged: 'รับทราบแล้ว', resolved: 'ปิดแล้ว' }
export function allowedTransitions(role, status) {
  if (role !== 'admin') return []
  return status === 'open' ? ['acknowledged', 'resolved'] : status === 'acknowledged' ? ['resolved'] : []
}
export function ruleBody(form, original) {
  const body = { name: String(form.get('name') || '').trim(), is_enabled: form.get('is_enabled') === 'on' }
  if (!body.name || body.name.length > 255 || body.name.includes('\0')) throw new Error('ชื่อกฎต้องมี 1–255 ตัวอักษร')
  const description = String(form.get('description') || '').trim()
  if (description.length > 255 || description.includes('\0')) throw new Error('คำอธิบายต้องไม่เกิน 255 ตัวอักษร')
  if (description) body.description = description
  else if (original?.description) throw new Error('API ยังไม่รองรับการล้างคำอธิบายเดิม กรุณาคงหรือแก้ไขข้อความ')
  for (const [key, min, max] of [['threshold', 1, 100000], ['window_seconds', 1, 86400], ['cooldown_seconds', 0, 604800], ['severity', 0, 10]]) {
    const raw = form.get(key), value = Number(raw)
    if (raw === null || String(raw).trim() === '' || !Number.isInteger(value) || value < min || value > max) throw new Error('ค่าตัวเลขอยู่นอกช่วงที่กำหนด')
    body[key] = value
  }
  if (original) return Object.fromEntries(Object.entries(body).filter(([key, value]) => value !== original[key]))
  return { ...body, rule_type: 'failed_login_threshold' }
}