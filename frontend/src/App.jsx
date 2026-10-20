import { useEffect, useState } from 'react'
import { api, errorText } from './api/client.js'
import Login from './features/auth/Login.jsx'
import Logs from './features/logs/Logs.jsx'
import Dashboard from './features/dashboard/Dashboard.jsx'
import Alerts from './features/alerts/Alerts.jsx'
import Rules from './features/alerts/Rules.jsx'
import Imports from './features/imports/Imports.jsx'
import IngestKeys from './features/ingest-keys/IngestKeys.jsx'
import { roles } from './locales/th.js'
import './App.css'

export default function App() {
  const [user, setUser] = useState(null), [loading, setLoading] = useState(true)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [route, setRoute] = useState(location.hash.slice(1) || '/dashboard')
  const [menu, setMenu] = useState(false), [busy, setBusy] = useState(false)
  async function restore(signal) {
    try { setUser((await api('/auth/me', { signal, expire: false })).user) }
    catch (e) { if (e.name !== 'AbortError' && e.status !== 401) setError(errorText(e)) }
    finally { if (!signal?.aborted) setLoading(false) }
  }
  useEffect(() => {
    const controller = new AbortController()
    api('/auth/me', { signal: controller.signal, expire: false })
      .then(result => setUser(result.user))
      .catch(e => { if (e.name !== 'AbortError' && e.status !== 401) setError(errorText(e)) })
      .finally(() => { if (!controller.signal.aborted) setLoading(false) })
    const navigate = () => { setRoute(location.hash.slice(1) || '/dashboard'); setMenu(false) }
    const expired = () => { setUser(null); setNotice('เซสชันหมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง') }
    window.addEventListener('hashchange', navigate); window.addEventListener('session-expired', expired)
    return () => { controller.abort(); window.removeEventListener('hashchange', navigate); window.removeEventListener('session-expired', expired) }
  }, [])
  async function logout() {
    setBusy(true); setError('')
    try { await api('/auth/logout', { method: 'POST' }); setUser(null); setNotice('ออกจากระบบแล้ว') }
    catch (e) { setError(errorText(e)) } finally { setBusy(false) }
  }
  if (loading) return <main className="session-screen" role="status">กำลังตรวจสอบการเข้าสู่ระบบ…</main>
  if (!user && error) return <main className="session-screen"><div role="alert">{error}</div><button onClick={() => { setLoading(true); setError(''); restore() }}>ลองเชื่อมต่ออีกครั้ง</button></main>
  if (!user) return <Login notice={notice} onLogin={value => { setUser(value); setNotice(''); setError('') }} />
  const path = route.split('?')[0], isLogs = path === '/logs' || /^\/logs\/[^/]+$/.test(path)
  return <div className="workspace">
    <a className="skip-link" href="#main-content" onClick={e => { e.preventDefault(); document.getElementById('main-content').focus() }}>ข้ามไปเนื้อหา</a>
    <aside className={`sidebar ${menu ? 'expanded' : ''}`}><a className="brand" href="#/dashboard"><span className="brand-mark">L</span><span>LogManage<small>ระบบจัดการบันทึกเหตุการณ์</small></span></a><p className="nav-caption">พื้นที่ทำงาน</p>
      <nav aria-label="เมนูหลัก"><a href="#/alerts" className={path.startsWith('/alerts') ? 'active' : ''} aria-current={path.startsWith('/alerts') ? 'page' : undefined}>△ <span>การแจ้งเตือน</span></a><a href="#/alert-rules" className={path === '/alert-rules' ? 'active' : ''} aria-current={path === '/alert-rules' ? 'page' : undefined}>⚙ <span>กฎการแจ้งเตือน</span></a><a className={path === '/dashboard' ? 'active' : ''} aria-current={path === '/dashboard' ? 'page' : undefined} href="#/dashboard">▥ <span>ภาพรวม</span></a><a className={isLogs ? 'active' : ''} aria-current={isLogs ? 'page' : undefined} href="#/logs">▤ <span>บันทึกเหตุการณ์</span></a><a className={path === '/account' ? 'active' : ''} aria-current={path === '/account' ? 'page' : undefined} href="#/account">◉ <span>บัญชีของฉัน</span></a>{user.role === 'admin' && <a href="#/imports" className={path.startsWith('/imports') ? 'active' : ''} aria-current={path.startsWith('/imports') ? 'page' : undefined}>↑ <span>นำเข้าและประวัติ</span></a>}{user.role === 'admin' && <a href="#/ingest-keys" className={path === '/ingest-keys' ? 'active' : ''} aria-current={path === '/ingest-keys' ? 'page' : undefined}>◇ <span>กุญแจรับข้อมูล</span></a>}</nav>
      <div className="sidebar-footer">{roles[user.role]}<small>ข้อมูลจำกัดเฉพาะองค์กรของคุณ</small></div>
    </aside>
    <div className="main-area"><header className="topbar"><button className="menu-button secondary" aria-expanded={menu} onClick={() => setMenu(!menu)}>เมนู</button><div><small>องค์กรปัจจุบัน</small><strong>{user.tenant?.name || 'องค์กรของคุณ'}</strong></div><div className="identity"><span>{user.display_name}<small>{roles[user.role]}</small></span><button className="secondary" disabled={busy} onClick={logout}>{busy ? 'กำลังออก…' : 'ออกจากระบบ'}</button></div></header>
      <main id="main-content" tabIndex={-1}>{error && <div className="error" role="alert">{error}</div>}
        {path === '/ingest-keys' ? <IngestKeys key={user.id + route} route={route} role={user.role} /> : (path === '/imports' || /^\/imports\/[^/]+$/.test(path)) ? <Imports key={user.id + route} route={route} role={user.role} /> : (path === '/alerts' || /^\/alerts\/[^/]+$/.test(path)) ? <Alerts key={user.id + route} route={route} role={user.role} /> : path === '/alert-rules' ? <Rules key={user.id + route} route={route} role={user.role} /> : path === '/dashboard' ? <Dashboard key={user.id + route} route={route} /> : isLogs ? <Logs key={user.id + route} route={route} /> : path === '/account' ? <><div className="page-title"><div><p className="eyebrow">บัญชีผู้ใช้งาน</p><h1>บัญชีของฉัน</h1><p>ข้อมูลบัญชีและองค์กรที่คุณกำลังใช้งาน</p></div></div><section className="panel account"><dl>{[['ชื่อ', user.display_name], ['อีเมล', user.email], ['บทบาท', roles[user.role]], ['องค์กร', user.tenant?.name || user.tenant_id]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl><p className="muted">แบบฟอร์มเปลี่ยนรหัสผ่านจะเพิ่มในระยะหน้าจัดการบัญชี ขณะนี้ไม่มีการเปลี่ยนรหัสผ่านของคุณ</p></section></> : <section className="panel empty"><h1>ไม่พบหน้าที่ต้องการ</h1><a href="#/logs">กลับไปบันทึกเหตุการณ์</a></section>}
      </main></div>
  </div>
}
