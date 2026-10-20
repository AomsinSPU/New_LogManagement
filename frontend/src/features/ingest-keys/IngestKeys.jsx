import { useEffect, useRef, useState } from 'react'
import { api, errorText } from '../../api/client.js'
import { useResource } from '../../api/useResource.js'
import { sources } from '../../locales/th.js'
import { formatDate } from '../../utils/format.js'
import Pagination from '../../components/Pagination.jsx'
import { createKeyBody, keyStatus } from './helpers.js'

export default function IngestKeys({ role, route }) {
  if (role !== 'admin') return <section className="panel empty"><h1>ไม่มีสิทธิ์จัดการกุญแจรับข้อมูล</h1><p>เฉพาะผู้ดูแลระบบเท่านั้น</p><a href="#/dashboard">กลับภาพรวม</a></section>
  return <KeyPage route={route} />
}

function KeyPage({ route }) {
  const [revision, setRevision] = useState(0), [creating, setCreating] = useState(false)
  const [issued, setIssued] = useState(null), [copied, setCopied] = useState(''), [error, setError] = useState('')
  const [busy, setBusy] = useState(false), [notice, setNotice] = useState('')
  const lock = useRef(false)
  const { data, loading, error: loadError } = useResource('/ingest-keys?' + (route.split('?')[1] || ''), revision)
  useEffect(() => {
    if (!issued) return
    const warn = event => { event.preventDefault(); event.returnValue = '' }
    window.addEventListener('beforeunload', warn)
    return () => window.removeEventListener('beforeunload', warn)
  }, [issued])
  async function revoke(key) {
    if (lock.current || key.revoked_at) return
    if (!window.confirm(`เพิกถอน “${key.name}” (${key.key_prefix})? เครื่องที่ใช้กุญแจนี้จะส่งข้อมูลไม่ได้ และเปิดใช้งานกุญแจเดิมกลับไม่ได้`)) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await api('/ingest-keys/' + encodeURIComponent(key.id), { method: 'DELETE' })
      if (issued?.key.id === key.id) setIssued(null)
      setNotice('เพิกถอนกุญแจเรียบร้อย'); setRevision(value => value + 1)
    } catch (e) { setError(errorText(e) + ' กรุณาโหลดสถานะล่าสุดก่อนดำเนินการซ้ำ') }
    finally { lock.current = false; setBusy(false) }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(issued.secret); setCopied('คัดลอกแล้ว — clipboard อาจยังเก็บ secret อยู่ กรุณาจัดเก็บอย่างปลอดภัย') }
    catch { setCopied('คัดลอกอัตโนมัติไม่ได้ กรุณาเลือกข้อความและคัดลอกด้วยตนเอง') }
  }
  return <>
    <div className="page-title"><div><p className="eyebrow">จัดการข้อมูล • ผู้ดูแลระบบ</p><h1>กุญแจรับข้อมูล</h1><p>สำหรับเครื่องส่ง logs ไม่ใช่รหัสผ่านเข้าสู่ระบบ</p></div><div className="action-row"><button className="secondary" disabled={loading || busy} onClick={() => { setError(''); setRevision(value => value + 1) }}>↻ รีเฟรช</button><button className="primary" disabled={creating || !!issued || busy} onClick={() => { setCreating(true); setNotice('') }}>สร้างกุญแจ</button></div></div>
    {notice && <div className="notice" role="status">{notice}</div>}
    {issued && <section className="panel rule-form secret-panel" aria-label="กุญแจที่เพิ่งสร้าง"><h2>แสดง secret หลังสร้างเท่านั้น</h2><p>กุญแจ: {issued.key.name} · Prefix: {issued.key.key_prefix}</p><p className="error">คัดลอกเก็บในที่ปลอดภัยก่อนปิดส่วนนี้ เปลี่ยนหน้า หรือ refresh — ไม่สามารถเรียก secret กลับจากรายการได้ อย่าใส่ secret ใน URL, Git หรือไฟล์ frontend</p><label>Secret<input className="mono" readOnly value={issued.secret} autoComplete="off" spellCheck={false} onFocus={event => event.target.select()} /></label><div className="action-row"><button className="primary" onClick={copy}>คัดลอก secret</button><button className="secondary" onClick={() => { if (window.confirm('เก็บ secret แล้วใช่หรือไม่? เมื่อปิดจะเรียกดูอีกไม่ได้')) { setIssued(null); setCopied('') } }}>เก็บแล้ว ปิด secret</button></div><p role="status">{copied}</p></section>}
    {creating && <CreateForm onCancel={() => setCreating(false)} onCreated={result => { setIssued(result); setCopied(''); setCreating(false); setRevision(value => value + 1) }} />}
    {(error || loadError) && <div className="error" role="alert">{error || loadError} <button className="secondary" disabled={busy} onClick={() => { setError(''); setRevision(value => value + 1) }}>โหลดสถานะกุญแจล่าสุด</button></div>}
    {loading && <div className="panel empty" role="status">กำลังโหลดกุญแจ…</div>}
    {!loading && data && <section className="panel results"><div className="results-title"><h2>รายการกุญแจ</h2><span>{data.data.length} รายการในหน้านี้</span></div>{!data.data.length ? <div className="empty">ยังไม่มีกุญแจรับข้อมูล</div> : <div className="table-scroll" tabIndex={0} aria-label="รายการกุญแจรับข้อมูล"><table><thead><tr>{['ชื่อ / prefix', 'แหล่งข้อมูลที่อนุญาต', 'สถานะ', 'หมดอายุ (เวลาไทย)', 'ใช้ล่าสุด', 'สร้างเมื่อ', 'การจัดการ'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.data.map(key => <tr key={key.id}><td className="message-cell"><strong>{key.name}</strong><span className="mono">{key.key_prefix}</span></td><td>{key.allowed_sources.map(source => sources[source] || source).join(', ')}</td><td>{keyStatus(key)}{key.revoked_at && <small className="muted"> {formatDate(key.revoked_at)}</small>}</td><td>{key.expires_at ? formatDate(key.expires_at) : 'ไม่กำหนด'}</td><td>{key.last_used_at ? formatDate(key.last_used_at) : 'ยังไม่มีข้อมูลการใช้'}</td><td>{formatDate(key.created_at)}</td><td><button className="secondary" disabled={busy || !!key.revoked_at} onClick={() => revoke(key)}>เพิกถอนกุญแจ</button></td></tr>)}</tbody></table></div>}<Pagination pagination={data.pagination} route={route} /></section>}
    <p className="muted">สถานะหมดอายุอ้างอิงเวลาของอุปกรณ์นี้ รีเฟรชเพื่ออัปเดต backend เป็นผู้ตัดสินสิทธิ์จริง ไม่มีการหมุนเวียนหรือเพิกถอนกุญแจเดิมโดยอัตโนมัติ</p>
  </>
}

function CreateForm({ onCancel, onCreated }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [uncertain, setUncertain] = useState(false)
  const lock = useRef(false)
  async function submit(event) {
    event.preventDefault(); if (lock.current || uncertain) return
    let body
    try { body = createKeyBody(new FormData(event.currentTarget)) } catch (e) { setError(e.message); return }
    if (!window.confirm(`สร้างกุญแจ “${body.name}” สำหรับ ${body.allowed_sources.join(', ')}?`)) return
    lock.current = true; setBusy(true); setError('')
    try { onCreated(await api('/ingest-keys', { method: 'POST', body })) }
    catch (e) { setError(errorText(e)); if (!e.status || e.status >= 500) setUncertain(true) }
    finally { lock.current = false; setBusy(false) }
  }
  return <form className="panel rule-form" onSubmit={submit}><h2>สร้างกุญแจรับข้อมูล</h2>{error && <div className="error" role="alert">{error}</div>}{uncertain && <div className="error" role="alert">ไม่ทราบผลการสร้าง กุญแจอาจถูกสร้างแล้วแต่ไม่ได้รับ secret กรุณาปิดฟอร์มและรีเฟรชรายการ ตรวจสอบและเพิกถอนกุญแจที่ไม่สามารถเก็บ secret ได้ก่อนสร้างใหม่ ไม่มีการส่งซ้ำอัตโนมัติ</div>}<fieldset disabled={busy || uncertain}><div className="filter-grid"><label>ชื่อกุญแจ<input autoFocus name="name" required maxLength={100} autoComplete="off" /></label><label>วันหมดอายุ (เวลาไทย UTC+7)<input name="expires_at" type="datetime-local" /><small className="muted">เว้นว่าง = ไม่กำหนดวันหมดอายุ</small></label></div><fieldset className="source-options"><legend>แหล่งข้อมูลที่อนุญาต (เลือกอย่างน้อย 1)</legend>{Object.entries(sources).map(([value, label]) => <label className="checkbox" key={value}><input type="checkbox" name="allowed_sources" value={value} />{label}</label>)}</fieldset><button className="primary">{busy ? 'กำลังสร้าง…' : 'ยืนยันสร้างกุญแจ'}</button></fieldset><div className="action-row"><button type="button" className="secondary" disabled={busy} onClick={onCancel}>ปิดฟอร์มสร้างกุญแจ</button></div></form>
}