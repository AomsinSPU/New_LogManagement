import { sources } from '../../locales/th.js'
export const MAX_BYTES = 1024 * 1024
export const importStatuses = { processing: 'กำลังประมวลผล', completed: 'สำเร็จทั้งหมด', partial: 'สำเร็จบางส่วน', failed: 'ไม่สำเร็จ' }
export function parseImport(text, fileName) {
  if (new TextEncoder().encode(text).length > MAX_BYTES) throw new Error('ไฟล์ต้องไม่เกิน 1 MiB (1,048,576 ไบต์)')
  let value
  try { value = JSON.parse(text.replace(/^\uFEFF/, '')) } catch { throw new Error('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง ไม่รองรับ JSONL หรือไฟล์ข้อความ syslog ในหน้านี้') }
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('ต้องเป็น object ที่มี source และ records ไม่ใช่ array เดี่ยว')
  if (Object.keys(value).some(key => !['source', 'filename', 'records'].includes(key))) throw new Error('รองรับเฉพาะ source, filename และ records ที่ระดับบนสุด')
  if (!Object.hasOwn(sources, value.source)) throw new Error('source ไม่อยู่ในรายการที่รองรับ')
  if (!Array.isArray(value.records) || value.records.length < 1 || value.records.length > 500) throw new Error('records ต้องมี 1–500 รายการ')
  const filename = value.filename === undefined ? fileName : value.filename
  if (typeof filename !== 'string' || !filename.trim() || filename.trim().length > 255 || [...filename].some(char => char.charCodeAt(0) < 32)) throw new Error('ชื่อไฟล์ต้องมี 1–255 ตัวอักษร และไม่มีอักขระควบคุม')
  const body = { source: value.source, filename: filename.trim(), records: value.records }
  const bytes = new TextEncoder().encode(JSON.stringify(body)).length
  if (bytes > MAX_BYTES) throw new Error('ข้อมูลรวมชื่อไฟล์ที่จะส่งเกิน 1 MiB กรุณาลดจำนวนรายการ')
  return { body, bytes }
}