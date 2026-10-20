import { useState } from 'react'
import { useResource } from '../../api/useResource.js'
import { navigate } from '../../utils/navigation.js'
import { sources, outcomes } from '../../locales/th.js'
import { formatDate, toApiTime, toThaiInput } from '../../utils/format.js'

export default function Logs({ route }) {
  const [formError, setError] = useState('')
  const [revision, setRevision] = useState(0), [copied, setCopied] = useState('')
  const [path, query = ''] = route.split('?'), params = new URLSearchParams(query)
  const id = path.startsWith('/logs/') ? path.slice(6) : null
  const { data, error: requestError, loading } = useResource(id ? `/logs/${encodeURIComponent(id)}` : `/logs?${query}`, revision)
  const error = formError || requestError
  function search(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget), next = new URLSearchParams()
    try {
      for (const [key, raw] of form) {
        const value = String(raw).trim(); if (value) next.set(key, ['from', 'to'].includes(key) ? toApiTime(value) : value)
      }
      if (next.has('from') && next.has('to') && Date.parse(next.get('from')) >= Date.parse(next.get('to'))) { setError('เวลาเริ่มต้องอยู่ก่อนเวลาสิ้นสุด'); return }
      setError(''); navigate('/logs?' + next.toString()); setRevision(v => v + 1)
    } catch { setError('รูปแบบวันเวลาไม่ถูกต้อง') }
  }
  function page(offset) { const next = new URLSearchParams(query); next.set('offset', offset); navigate('/logs?' + next.toString()) }
  async function copy(value) { try { await navigator.clipboard.writeText(value); setCopied('คัดลอกแล้ว') } catch { setCopied('คัดลอกไม่ได้ กรุณาเลือกข้อความด้วยตนเอง') } }
  const log = id ? data?.data : null
  const rawText = typeof log?.raw === 'string' ? log.raw : JSON.stringify(log?.raw ?? null, null, 2)
  return <><div className="page-title"><div><p className="eyebrow">ตรวจสอบและค้นหาข้อมูล</p><h1>{id ? 'รายละเอียดเหตุการณ์' : 'บันทึกเหตุการณ์'}</h1><p>ข้อมูลจากองค์กรของคุณ · เวลาไทย (UTC+7) · ปี ค.ศ.</p></div><button className="secondary" disabled={loading} onClick={() => setRevision(v => v + 1)}>↻ รีเฟรช</button></div>
    {id ? <a className="back-link" href={`#/logs${query ? '?' + query : ''}`}>← กลับรายการ</a> : <form className="panel filters" key={query} onSubmit={search}>
      <label className="search-field">ค้นหาในข้อความเหตุการณ์<input name="q" defaultValue={params.get('q') || ''} placeholder="เช่น login หรือชื่อบริการ" maxLength={255} /></label>
      <label>แหล่งข้อมูล<select name="source" defaultValue={params.get('source') || ''}><option value="">ทั้งหมด</option>{Object.entries(sources).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <label>ผลลัพธ์<select name="outcome" defaultValue={params.get('outcome') || ''}><option value="">ทั้งหมด</option>{Object.entries(outcomes).map(([key, text]) => <option key={key} value={key}>{text}</option>)}</select></label>
      <label>ตั้งแต่ (เวลาไทย)<input type="datetime-local" name="from" defaultValue={toThaiInput(params.get('from'))} /></label><label>ก่อน (เวลาไทย)<input type="datetime-local" name="to" defaultValue={toThaiInput(params.get('to'))} /></label>
      <details className="advanced"><summary>ตัวกรองเพิ่มเติม — IP, ผู้ใช้, ประเภท, ระดับ, Batch</summary><div className="filter-grid">{[['src_ip', 'IP ต้นทาง'], ['dst_ip', 'IP ปลายทาง'], ['user', 'ผู้ใช้ในเหตุการณ์'], ['event_type', 'ประเภทเหตุการณ์'], ['batch_id', 'Batch ID']].map(([key, title]) => <label key={key}>{title}<input name={key} defaultValue={params.get(key) || ''} maxLength={255} /></label>)}<label>ระดับความรุนแรง<select name="severity" defaultValue={params.get('severity') || ''}><option value="">ทั้งหมด</option>{Array.from({ length: 11 }, (_, i) => <option key={i} value={i}>{i}</option>)}</select></label></div></details>
      <div className="filter-actions"><small className="muted">ไม่กำหนดเวลา = ค้นหาทุกช่วงที่จัดเก็บ</small><a href="#/logs">ล้างตัวกรอง</a><button className="primary" disabled={loading}>ค้นหา</button></div>
    </form>}
    {error && <div role="alert" className="error">{error} <button className="secondary" onClick={() => setRevision(v => v + 1)}>ลองใหม่</button></div>}
    {loading && <section className="panel empty" role="status">กำลังโหลดข้อมูล…</section>}
    {!loading && !error && log && <section className="panel detail"><div className="detail-heading"><h2>{log.message || log.event_type}</h2><span className={`badge ${log.outcome}`}>{outcomes[log.outcome] || 'ไม่ทราบผล'}</span></div><dl>{[['รหัสเหตุการณ์', log.id], ['เวลาเกิดเหตุการณ์', formatDate(log.event_timestamp)], ['เวลารับข้อมูล', formatDate(log.ingested_at)], ['แหล่งข้อมูล', sources[log.source] || log.source], ['ประเภท', log.event_type], ['ระดับความรุนแรง', log.severity], ['IP ต้นทาง', log.src_ip], ['IP ปลายทาง', log.dst_ip], ['ผู้ใช้ในเหตุการณ์', log.actor_user], ['เครื่อง', log.host], ['Batch ID', log.batch_id]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl><h3>Metadata</h3><pre>{JSON.stringify(log.metadata, null, 2)}</pre><div className="detail-heading"><h3>ข้อมูลต้นฉบับ</h3><button className="secondary" onClick={() => copy(rawText)}>คัดลอก</button></div><p role="status">{copied}</p><pre>{rawText}</pre></section>}
    {!id && !loading && !error && data && <section className="panel results"><div className="results-title"><h2>รายการเหตุการณ์</h2><span className="muted">{data.data.length} รายการในหน้านี้</span></div>{data.data.length === 0 ? <div className="empty"><h3>ไม่พบเหตุการณ์</h3><p>ลองขยายช่วงเวลาหรือล้างตัวกรอง หากเพิ่งเริ่มใช้งานให้ส่งข้อมูลเข้าระบบก่อน</p></div> : <div className="table-scroll" tabIndex={0} aria-label="ตารางบันทึกเหตุการณ์"><table><thead><tr>{['เวลาเกิดเหตุการณ์', 'แหล่งข้อมูล', 'ประเภท / ข้อความ', 'ระดับ', 'IP ต้นทาง', 'ผู้ใช้', 'ผลลัพธ์', ''].map((title, i) => <th key={i} scope="col">{title}</th>)}</tr></thead><tbody>{data.data.map(row => <tr key={row.id}><td className="time-cell">{formatDate(row.event_timestamp)}</td><td><span className="source-tag">{sources[row.source] || row.source}</span></td><td className="message-cell"><strong>{row.event_type}</strong><span>{row.message || 'ไม่มีข้อความสรุป'}</span></td><td>{row.severity ?? '—'}</td><td className="mono">{row.src_ip || '—'}</td><td>{row.actor_user || '—'}</td><td><span className={`badge ${row.outcome}`}>{outcomes[row.outcome] || 'ไม่ทราบผล'}</span></td><td><a aria-label={`รายละเอียด ${row.id}`} href={`#/logs/${row.id}${query ? '?' + query : ''}`}>ดูรายละเอียด →</a></td></tr>)}</tbody></table></div>}<div className="pagination"><span>เริ่มที่รายการ {data.data.length ? data.pagination.offset + 1 : 0}</span><div><button className="secondary" disabled={!data.pagination.offset} onClick={() => page(Math.max(0, data.pagination.offset - data.pagination.limit))}>ก่อนหน้า</button><button className="secondary" disabled={!data.pagination.has_more} onClick={() => page(data.pagination.offset + data.pagination.limit)}>ถัดไป</button></div></div></section>}
  </>
}
