import { useEffect, useRef, useState } from 'react'
import { api, errorText } from '../../api/client.js'
import { useResource } from '../../api/useResource.js'
import { sources } from '../../locales/th.js'
import { formatDate } from '../../utils/format.js'
import { navigate } from '../../utils/navigation.js'
import Pagination from '../../components/Pagination.jsx'
import { importStatuses, MAX_BYTES, parseImport } from './validation.js'

export default function Imports({ role, route }) {
  if (role !== 'admin') return <section className="panel empty"><h1>ไม่มีสิทธิ์เข้าหน้านำเข้า</h1><p>เฉพาะผู้ดูแลระบบเท่านั้น</p><a href="#/dashboard">กลับภาพรวม</a></section>
  return <ImportPage key={route} route={route} />
}

function ImportPage({ route }) {
  const [revision, setRevision] = useState(0)
  const [path, query = ''] = route.split('?'), id = path.startsWith('/imports/') ? path.slice(9) : null
  const { data, loading, error } = useResource(id ? '/imports/' + encodeURIComponent(id) : '/imports?' + query, revision)
  return <>
    <div className="page-title"><div><p className="eyebrow">จัดการข้อมูล • ผู้ดูแลระบบ</p><h1>{id ? 'รายละเอียดการนำเข้า' : 'นำเข้าและประวัติ'}</h1><p>ประวัติรวมทั้งไฟล์ที่ผู้ใช้อัปโหลดและ batch จากเครื่อง ภายในองค์กรของคุณ</p></div><button className="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>↻ รีเฟรช</button></div>
    {id ? <a className="back-link" href={'#/imports' + (query ? '?' + query : '')}>← กลับประวัติการนำเข้า</a> : <Upload onImported={() => setRevision(value => value + 1)} />}
    {!id && <form className="panel filters" onSubmit={event => { event.preventDefault(); const params = new URLSearchParams(); for (const [key, value] of new FormData(event.currentTarget)) if (value) params.set(key, value); navigate('/imports?' + params) }}>
      <label>แหล่งข้อมูล<select name="source" defaultValue={new URLSearchParams(query).get('source') || ''}><option value="">ทั้งหมด</option>{Object.entries(sources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <label>สถานะ<select name="status" defaultValue={new URLSearchParams(query).get('status') || ''}><option value="">ทั้งหมด</option>{Object.entries(importStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <div className="filter-actions"><button className="primary">กรองประวัติ</button><a href="#/imports">ล้างตัวกรอง</a></div>
    </form>}
    {error && <div className="error" role="alert">{error} <button className="secondary" onClick={() => setRevision(value => value + 1)}>ลองโหลดใหม่</button></div>}
    {loading && <div className="panel empty" role="status">กำลังโหลดประวัติ…</div>}
    {!loading && id && data && <BatchResult batch={data.data} />}
    {!loading && !id && data && <section className="panel results"><div className="results-title"><h2>ประวัติการนำเข้า</h2><span>{data.data.length} รายการในหน้านี้</span></div>{!data.data.length ? <div className="empty">ไม่พบประวัติตามเงื่อนไขนี้</div> : <div className="table-scroll" tabIndex={0} aria-label="ประวัติการนำเข้า"><table><thead><tr>{['สร้างเมื่อ', 'ชื่อไฟล์ / ช่องทาง', 'แหล่งข้อมูล', 'สถานะ', 'ทั้งหมด', 'รับแล้ว', 'ปฏิเสธ', 'รายละเอียด'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.data.map(batch => <tr key={batch.id}><td className="time-cell">{formatDate(batch.created_at)}</td><td className="message-cell"><strong>{batch.filename || 'ไม่ระบุชื่อไฟล์'}</strong><span>{batch.ingest_key_id ? 'เครื่อง / ingest key' : batch.submitted_by ? 'ผู้ใช้งาน' : 'ไม่ระบุช่องทาง'}</span></td><td>{sources[batch.source] || batch.source}</td><td><span className={'badge ' + batch.status}>{importStatuses[batch.status] || batch.status}</span></td><td>{batch.total_count}</td><td>{batch.accepted_count}</td><td>{batch.rejected_count}</td><td><a href={`#/imports/${batch.id}${query ? '?' + query : ''}`}>ดู batch →</a></td></tr>)}</tbody></table></div>}<Pagination route={route} pagination={data.pagination} /></section>}
  </>
}

function Upload({ onImported }) {
  const [prepared, setPrepared] = useState(null), [error, setError] = useState(''), [result, setResult] = useState(null)
  const [reading, setReading] = useState(false), [busy, setBusy] = useState(false), [uncertain, setUncertain] = useState(false)
  const version = useRef(0), lock = useRef(false), input = useRef(null)
  useEffect(() => () => { version.current++ }, [])
  async function select(event) {
    const file = event.target.files?.[0], current = ++version.current
    setPrepared(null); setError(''); setResult(null); setReading(false)
    if (!file) return
    if (file.size > MAX_BYTES) { setError('ไฟล์ต้องไม่เกิน 1 MiB (1,048,576 ไบต์)'); return }
    setReading(true)
    try { const text = await file.text(); if (current === version.current) setPrepared(parseImport(text, file.name)) }
    catch (e) { if (current === version.current) setError(e.message) }
    finally { if (current === version.current) setReading(false) }
  }
  async function submit(event) {
    event.preventDefault()
    if (lock.current || !prepared || uncertain) return
    if (!window.confirm(`ยืนยันนำเข้า ${prepared.body.records.length} รายการจาก ${prepared.body.filename}? ข้อมูลที่รับแล้วจะไม่ถูกย้อนกลับด้วยหน้านี้`)) return
    lock.current = true; setBusy(true); setError(''); setResult(null)
    try {
      const response = await api('/imports', { method: 'POST', body: prepared.body })
      setResult(response.data); setPrepared(null); if (input.current) input.current.value = ''; onImported()
    } catch (e) {
      setError(errorText(e))
      if (!e.status || e.status >= 500) { setUncertain(true); onImported() }
    } finally { lock.current = false; setBusy(false) }
  }
  return <section className="panel rule-form"><h2>นำเข้าไฟล์ JSON</h2><p className="muted">สูงสุด 500 records และ 1 MiB รวมชื่อไฟล์ ส่งเป็น application/json ไม่ใช่ multipart ระบบตรวจแต่ละ record อีกครั้งและอาจรับได้เพียงบางรายการ</p>
    <details><summary>รูปแบบไฟล์ที่รองรับ</summary><pre>{JSON.stringify({ source: 'api', records: [{ source: 'api', event_type: 'authentication', outcome: 'failure', src_ip: '192.0.2.1', message: 'Example event' }] }, null, 2)}</pre><p>source ในแต่ละ record ต้องตรงกับ batch รองรับ common JSON และ vendor envelope ที่ backend รองรับ ไม่แปลง CSV/JSONL/syslog ให้อัตโนมัติ</p></details>
    <form onSubmit={submit}><label>ไฟล์ JSON<input ref={input} type="file" accept=".json,application/json" disabled={busy || uncertain} onChange={select} /></label>
      {reading && <p role="status">กำลังตรวจไฟล์…</p>}
      {prepared && <p className="notice">พร้อมส่ง: {prepared.body.filename} · {sources[prepared.body.source]} · {prepared.body.records.length} รายการ · {prepared.bytes.toLocaleString()} ไบต์ (ยังไม่ส่งข้อมูล)</p>}
      {error && <div className="error" role="alert">{error}</div>}
      {uncertain && <div className="error" role="alert"><p>ยังยืนยันผลการนำเข้าไม่ได้ ข้อมูลอาจถูกบันทึกแล้ว ระบบไม่มี idempotency key จึงไม่ส่งซ้ำอัตโนมัติ กรุณารีเฟรชและตรวจประวัติก่อนดำเนินการต่อ</p><button type="button" className="secondary" onClick={() => { if (window.confirm('ตรวจประวัติแล้วและยอมรับว่าการส่งไฟล์เดิมซ้ำอาจสร้างข้อมูลซ้ำใช่หรือไม่?')) { setUncertain(false); setPrepared(null); setError(''); if (input.current) input.current.value = '' } }}>ตรวจประวัติแล้ว เริ่มเลือกไฟล์ใหม่</button></div>}
      <div className="action-row"><button className="primary" disabled={!prepared || reading || busy || uncertain}>{busy ? 'กำลังนำเข้า…' : 'ยืนยันนำเข้า'}</button></div>
    </form>{result && <BatchResult batch={result} />}
  </section>
}

function BatchResult({ batch }) {
  const errors = Array.isArray(batch.error_summary) ? batch.error_summary : []
  return <section className="panel detail" aria-label="ผลการนำเข้า"><h2>ผลการนำเข้า: {importStatuses[batch.status] || batch.status}</h2><dl>{[['Batch ID', batch.id], ['ชื่อไฟล์', batch.filename], ['แหล่งข้อมูล', sources[batch.source] || batch.source], ['ทั้งหมด', batch.total_count], ['รับแล้ว', batch.accepted_count], ['ปฏิเสธ', batch.rejected_count], ['สร้างเมื่อ', formatDate(batch.created_at)], ['เสร็จเมื่อ', formatDate(batch.completed_at)]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
    <a href={'#/logs?batch_id=' + encodeURIComponent(batch.id)}>เปิด Logs ของ batch นี้ →</a>
    {batch.status === 'processing' && <p className="muted">ยังประมวลผลอยู่ ให้รีเฟรชรายละเอียดภายหลัง</p>}
    {batch.rejected_count > 0 && <p className="error">มีรายการที่ถูกปฏิเสธ อย่าส่งไฟล์ทั้งชุดซ้ำ เพราะรายการที่รับแล้วอาจซ้ำ</p>}
    {errors.length > 0 && <><h3>ข้อผิดพลาดรายรายการ (แสดงสูงสุด 50 รายการ)</h3><div className="table-scroll"><table><thead><tr><th>ลำดับใน records (เริ่มที่ 1)</th><th>สาเหตุจากระบบ</th></tr></thead><tbody>{errors.map((item, index) => <tr key={index}><td>{Number.isInteger(item.index) ? item.index + 1 : '—'}</td><td>{item.message}</td></tr>)}</tbody></table></div></>}
  </section>
}