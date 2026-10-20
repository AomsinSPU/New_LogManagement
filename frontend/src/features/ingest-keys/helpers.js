import { sources } from '../../locales/th.js'
import { toApiTime } from '../../utils/format.js'
export function createKeyBody(form, now = Date.now()) {
  const name = String(form.get('name') || '').trim()
  if (!name || name.length > 100 || name.includes('\0')) throw new Error('ชื่อกุญแจต้องมี 1–100 ตัวอักษร')
  const allowed_sources = form.getAll('allowed_sources')
  if (!allowed_sources.length || allowed_sources.length > 7 || new Set(allowed_sources).size !== allowed_sources.length || allowed_sources.some(source => !Object.hasOwn(sources, source))) throw new Error('เลือกแหล่งข้อมูลอย่างน้อยหนึ่งรายการ โดยไม่ซ้ำกัน')
  const expiry = form.get('expires_at')
  let expires_at = null
  if (expiry) {
    try { expires_at = toApiTime(expiry) } catch { throw new Error('วันหมดอายุไม่ถูกต้อง') }
    if (Date.parse(expires_at) <= now) throw new Error('วันหมดอายุต้องอยู่ในอนาคต (เวลาไทย)')
  }
  return { name, allowed_sources, expires_at }
}
export function keyStatus(key, now = Date.now()) {
  if (key.revoked_at) return 'เพิกถอนแล้ว'
  if (key.expires_at && Date.parse(key.expires_at) <= now) return 'หมดอายุแล้ว'
  return 'ยังไม่หมดอายุ/ไม่ถูกเพิกถอน'
}