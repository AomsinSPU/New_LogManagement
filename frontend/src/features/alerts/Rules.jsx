import { useRef, useState } from 'react'
import { api, errorText } from '../../api/client.js'
import { useResource } from '../../api/useResource.js'
import Pagination from '../../components/Pagination.jsx'
import { ruleBody } from './helpers.js'

export default function Rules({ route, role }) {
  const [revision, setRevision] = useState(0), [editing, setEditing] = useState(null)
  const [notice, setNotice] = useState('')
  const { data, loading, error } = useResource('/alert-rules?' + (route.split('?')[1] || ''), revision)
  return <>
    <div className="page-title"><div><p className="eyebrow">ตั้งค่าเงื่อนไขตรวจจับ</p><h1>กฎการแจ้งเตือน</h1><p>ตรวจ authentication ที่ล้มเหลวจาก IP เดียวกัน ตามช่วงเวลารับข้อมูลล่าสุด</p></div><div className="action-row"><button className="secondary" disabled={loading || !!editing} onClick={() => setRevision(value => value + 1)}>↻ รีเฟรช</button>{role === 'admin' && <button className="primary" disabled={!!editing} onClick={() => { setNotice(''); setEditing({}) }}>สร้างกฎ</button>}</div></div>
    <div className="notice">ต้องเปิดใช้งาน alert worker แยกต่างหาก กฎนี้ไม่ได้ประเมินข้อมูลย้อนหลังทั้งหมด และหน้านี้ไม่ยืนยันว่า worker กำลังทำงาน</div>
    {role !== 'admin' && <p className="muted">ผู้ดูข้อมูลอ่านกฎได้เท่านั้น</p>}
    {notice && <p className="notice" role="status">{notice}</p>}
    {editing && role === 'admin' && <RuleForm key={editing.id || 'new'} original={editing.id ? editing : null} onCancel={() => setEditing(null)} onSaved={() => { setEditing(null); setNotice('บันทึกกฎเรียบร้อย'); setRevision(value => value + 1) }} />}
    {error && <div className="error" role="alert">{error} <button className="secondary" onClick={() => setRevision(value => value + 1)}>ลองใหม่</button></div>}
    {loading && <div className="panel empty" role="status">กำลังโหลดกฎ…</div>}
    {!loading && data && <section className="panel results">{!data.data.length ? <div className="empty">ยังไม่มีกฎการแจ้งเตือน</div> : <div className="table-scroll" tabIndex={0} aria-label="กฎการแจ้งเตือน"><table><thead><tr>{['ชื่อกฎ', 'เงื่อนไข', 'พักการแจ้งซ้ำ', 'ระดับ', 'สถานะ', 'การจัดการ'].map(label => <th scope="col" key={label}>{label}</th>)}</tr></thead><tbody>{data.data.map(row => <tr key={row.id}><td className="message-cell"><strong>{row.name}</strong><span>{row.description}</span></td><td>ล้มเหลว ≥ {row.threshold} ครั้ง / {row.window_seconds} วินาที</td><td>{row.cooldown_seconds} วินาที</td><td>{row.severity}</td><td><span className={'badge ' + (row.is_enabled ? 'success' : '')}>{row.is_enabled ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}</span></td><td>{role === 'admin' ? <button className="secondary" disabled={!!editing} onClick={() => { setNotice(''); setEditing(row) }}>แก้ไขกฎ</button> : 'อ่านอย่างเดียว'}</td></tr>)}</tbody></table></div>}<Pagination pagination={data.pagination} route={route} /></section>}
  </>
}

function RuleForm({ original, onCancel, onSaved }) {
  const [busy, setBusy] = useState(false), [error, setError] = useState('')
  const lock = useRef(false)
  async function submit(event) {
    event.preventDefault(); if (lock.current) return
    let body
    try { body = ruleBody(new FormData(event.currentTarget), original) } catch (e) { setError(e.message); return }
    if (!Object.keys(body).length) { setError('ยังไม่มีข้อมูลที่เปลี่ยนแปลง'); return }
    if (!window.confirm(original ? 'ยืนยันบันทึกการเปลี่ยนแปลงกฎ?' : 'ยืนยันสร้างกฎการแจ้งเตือน?')) return
    lock.current = true; setBusy(true); setError('')
    try { await api(original ? '/alert-rules/' + encodeURIComponent(original.id) : '/alert-rules', { method: original ? 'PATCH' : 'POST', body }); onSaved() }
    catch (e) { setError(errorText(e) + (original ? '' : ' หากการเชื่อมต่อขาดหลังส่ง ให้ยกเลิกฟอร์มและรีเฟรชรายการก่อนสร้างซ้ำ')) }
    finally { lock.current = false; setBusy(false) }
  }
  return <form className="panel rule-form" onSubmit={submit}><h2>{original ? 'แก้ไขกฎการแจ้งเตือน' : 'สร้างกฎการแจ้งเตือน'}</h2>{error && <div className="error" role="alert">{error}</div>}<fieldset disabled={busy}><div className="filter-grid">
    <label>ชื่อกฎ<input autoFocus name="name" required maxLength={255} defaultValue={original?.name || ''} /></label>
    <label>คำอธิบาย<input name="description" maxLength={255} defaultValue={original?.description || ''} /><small className="muted">แก้ไขได้ แต่ API ยังไม่รองรับล้างคำอธิบายเดิม</small></label>
    <label>จำนวนล้มเหลวขั้นต่ำ<input type="number" name="threshold" required min={1} max={100000} step={1} defaultValue={original?.threshold ?? 5} /></label>
    <label>ช่วงเวลารับข้อมูล (วินาที)<input type="number" name="window_seconds" required min={1} max={86400} step={1} defaultValue={original?.window_seconds ?? 300} /></label>
    <label>พักการแจ้งซ้ำ (วินาที)<input type="number" name="cooldown_seconds" required min={0} max={604800} step={1} defaultValue={original?.cooldown_seconds ?? 300} /></label>
    <label>ระดับความรุนแรง (0–10)<input type="number" name="severity" required min={0} max={10} step={1} defaultValue={original?.severity ?? 5} /></label>
    <label className="checkbox"><input type="checkbox" name="is_enabled" defaultChecked={original?.is_enabled ?? true} />เปิดใช้งานกฎ</label>
    </div><div className="action-row"><button className="primary">{busy ? 'กำลังบันทึก…' : 'บันทึกกฎ'}</button><button type="button" className="secondary" onClick={onCancel}>ยกเลิก</button></div></fieldset></form>
}