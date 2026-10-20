const base = (import.meta.env?.VITE_API_URL || 'http://localhost:3000').replace(/\/$/, '')
export function errorText(error) {
  return ({ 400: 'ข้อมูลไม่ถูกต้อง กรุณาตรวจสอบข้อมูลที่กรอก', 401: 'ข้อมูลเข้าสู่ระบบไม่ถูกต้อง หรือเซสชันหมดอายุ',
    403: 'ไม่มีสิทธิ์ หรือ origin ของหน้าเว็บไม่ได้รับอนุญาต', 404: 'ไม่พบข้อมูลในองค์กรของคุณ',
    409: 'สถานะขัดแย้งกับข้อมูลปัจจุบัน กรุณาโหลดสถานะล่าสุด', 413: 'ข้อมูลมีขนาดใหญ่เกินกำหนด',
    429: 'ส่งคำขอบ่อยเกินไป กรุณารอสักครู่', 500: 'ระบบขัดข้อง กรุณาลองใหม่', 503: 'ระบบยังไม่พร้อมใช้งาน กรุณาลองภายหลัง' })[error.status] || 'เชื่อมต่อระบบไม่ได้ กรุณาตรวจสอบ backend และเครือข่าย'
}
export async function api(path, { method = 'GET', body, signal, expire = true } = {}) {
  const response = await fetch(base + path, { method, credentials: 'include', signal,
    headers: body !== undefined ? { 'Content-Type': 'application/json' } : {}, body: body !== undefined ? JSON.stringify(body) : undefined })
  if (!response.ok) {
    if (response.status === 401 && expire && typeof window !== 'undefined') window.dispatchEvent(new Event('session-expired'))
    const error = new Error('API request failed'); error.status = response.status; throw error
  }
  return response.status === 204 ? null : response.json()
}