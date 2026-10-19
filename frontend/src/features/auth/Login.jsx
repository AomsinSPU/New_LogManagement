import { useState } from 'react'
import { api, errorText } from '../../api/client.js'
export default function Login({ notice, onLogin }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [show, setShow] = useState(false)
  async function submit(event) {
    event.preventDefault(); if (busy) return
    const form = new FormData(event.currentTarget)
    setBusy(true); setError('')
    try { onLogin((await api('/auth/login', { method: 'POST', expire: false, body: { email: form.get('email'), password: form.get('password'), remember: form.get('remember') === 'on' } })).user) }
    catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  return <main className="login-page"><section className="login-intro"><div className="brand"><span className="brand-mark">L</span>LogManage</div><p className="eyebrow">ข้อมูลชัดเจน • ตรวจสอบได้</p><h1>ทุกเหตุการณ์<br />ในพื้นที่เดียว</h1><p>ค้นหา ตรวจสอบ และติดตามบันทึกเหตุการณ์<br />ภายในองค์กรของคุณ</p><div className="intro-grid"><span>01<br /><b>รวบรวมข้อมูล</b></span><span>02<br /><b>ตรวจสอบเหตุการณ์</b></span><span>03<br /><b>ติดตามการแจ้งเตือน</b></span></div></section>
    <section className="login-form"><p className="eyebrow">ยินดีต้อนรับ</p><h2>เข้าสู่ระบบ</h2><p className="muted">ใช้บัญชีที่ผู้ดูแลระบบจัดเตรียมให้</p>
      {notice && <div className="notice" role="status">{notice}</div>}{error && <div className="error" role="alert">{error}</div>}
      <form onSubmit={submit}><label>อีเมล<input name="email" type="email" autoComplete="username" required maxLength={254} placeholder="name@company.com" disabled={busy} /></label>
        <label>รหัสผ่าน<div className="password-field"><input name="password" type={show ? 'text' : 'password'} autoComplete="current-password" required maxLength={1024} disabled={busy} /><button type="button" className="secondary" aria-pressed={show} onClick={() => setShow(!show)}>{show ? 'ซ่อน' : 'แสดง'}</button></div></label>
        <label className="checkbox"><input name="remember" type="checkbox" disabled={busy} />จดจำการเข้าสู่ระบบ</label><small className="muted">ระบบจะหมดเซสชันเมื่อไม่ใช้งานเกิน 30 นาที</small>
        <button className="primary full" disabled={busy}>{busy ? 'กำลังเข้าสู่ระบบ…' : 'เข้าสู่ระบบ →'}</button>
      </form><p className="login-foot">มีปัญหาการเข้าใช้งาน? กรุณาติดต่อผู้ดูแลระบบของคุณ</p>
    </section></main>
}