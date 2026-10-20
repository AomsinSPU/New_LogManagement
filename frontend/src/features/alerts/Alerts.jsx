import { useRef, useState } from 'react'
import { api, errorText } from '../../api/client.js'
import { useResource } from '../../api/useResource.js'
import { formatDate } from '../../utils/format.js'
import { navigate } from '../../utils/navigation.js'
import Pagination from '../../components/Pagination.jsx'
import { allowedTransitions, statuses } from './helpers.js'

export default function Alerts({ route, role }) {
  const [revision, setRevision] = useState(0), [busy, setBusy] = useState(false)
  const [error, setError] = useState(''), [notice, setNotice] = useState('')
  const lock = useRef(false)
  const [path, query = ''] = route.split('?'), id = path.startsWith('/alerts/') ? path.slice(8) : null
  const { data, loading, error: loadError } = useResource(id ? '/alerts/' + encodeURIComponent(id) : '/alerts?' + query, revision)
  const alert = id ? data?.data : null
  async function changeStatus(status) {
    if (lock.current || !allowedTransitions(role, alert?.status).includes(status)) return
    if (!window.confirm(`ยืนยันเปลี่ยนสถานะเป็น “${statuses[status]}”${status === 'resolved' ? ' เมื่อปิดแล้วจะเปิดกลับไม่ได้' : ''}?`)) return
    lock.current = true; setBusy(true); setError(''); setNotice('')
    try {
      await api('/alerts/' + encodeURIComponent(id), { method: 'PATCH', body: { status } })
      setNotice('เปลี่ยนสถานะเรียบร้อย'); setRevision(value => value + 1)
    } catch (e) { setError(errorText(e)) }
    finally { lock.current = false; setBusy(false) }
  }
  return <>
    <div className="page-title"><div><p className="eyebrow">ติดตามเหตุการณ์ที่ต้องตรวจสอบ</p><h1>{id ? 'รายละเอียดการแจ้งเตือน' : 'การแจ้งเตือน'}</h1><p>แจ้งเตือนสร้างโดย worker ตามกฎที่เปิดใช้งาน ไม่ใช่สถานะออนไลน์ของ collector</p></div><button className="secondary" disabled={loading || busy} onClick={() => { setError(''); setRevision(value => value + 1) }}>↻ รีเฟรช</button></div>
    {id ? <a className="back-link" href={'#/alerts' + (query ? '?' + query : '')}>← กลับการแจ้งเตือน</a> : <form className="panel filters" onSubmit={event => { event.preventDefault(); const next = new URLSearchParams(); const status = new FormData(event.currentTarget).get('status'); if (status) next.set('status', status); navigate('/alerts?' + next) }}><label>สถานะ<select name="status" defaultValue={new URLSearchParams(query).get('status') || ''}><option value="">ทั้งหมด</option>{Object.entries(statuses).map(([value, label]) => <option value={value} key={value}>{label}</option>)}</select></label><div className="filter-actions"><button className="primary">ใช้ตัวกรอง</button><a href="#/alerts">ล้างตัวกรอง</a></div></form>}
    {notice && <div className="notice" role="status">{notice}</div>}
    {(error || loadError) && <div className="error" role="alert">{error || loadError} <button className="secondary" disabled={busy} onClick={() => { setError(''); setRevision(value => value + 1) }}>โหลดสถานะล่าสุด</button></div>}
    {loading && <div className="panel empty" role="status">กำลังโหลดการแจ้งเตือน…</div>}
    {!loading && alert && <section className="panel detail"><div className="detail-heading"><h2>{alert.title}</h2><span className={'badge ' + alert.status}>{statuses[alert.status] || alert.status}</span></div>
      <dl>{[['รหัสการแจ้งเตือน', alert.id], ['ระดับความรุนแรง', alert.severity], ['IP ต้นทาง', alert.src_ip], ['จำนวนเหตุการณ์', alert.event_count], ['เริ่มช่วงเวลารับข้อมูล', formatDate(alert.window_start)], ['ก่อนสิ้นสุดช่วงเวลารับข้อมูล', formatDate(alert.window_end)], ['สร้างเมื่อ', formatDate(alert.created_at)], ['รับทราบเมื่อ', formatDate(alert.acknowledged_at)], ['ปิดเมื่อ', formatDate(alert.resolved_at)], ['รหัสกฎ', alert.rule_id]].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value ?? '—'}</dd></div>)}</dl>
      <div className="action-row">{allowedTransitions(role, alert.status).map(status => <button className={status === 'resolved' ? 'secondary' : 'primary'} key={status} disabled={busy} onClick={() => changeStatus(status)}>{status === 'resolved' ? 'ปิดการแจ้งเตือน' : 'รับทราบการแจ้งเตือน'}</button>)}</div>
      {role !== 'admin' && <p className="muted">ผู้ดูข้อมูลอ่านได้เท่านั้น การเปลี่ยนสถานะต้องดำเนินการโดยผู้ดูแลระบบ</p>}
      {alert.status === 'resolved' && <p className="muted">การแจ้งเตือนนี้ปิดแล้ว และไม่สามารถเปิดกลับได้</p>}
      <h3>หลักฐานเหตุการณ์</h3><p className="muted">ช่วงเวลาข้างต้นอ้างอิงเวลารับข้อมูล ไม่ใช่เวลาเกิดเหตุการณ์ หลักฐานอาจถูก retention ลบแล้ว หากเปิดไม่พบ ไม่ได้หมายความว่าการแจ้งเตือนไม่เคยเกิดขึ้น</p>
      {alert.evidence?.sampled && <div className="notice">แสดงตัวอย่างหลักฐานสูงสุด 20 รายการ ไม่ใช่เหตุการณ์ทั้งหมด</div>}
      <ul className="evidence-list">{(alert.evidence?.log_ids || []).map(logId => <li key={logId}><a href={'#/logs/' + encodeURIComponent(logId)}>{logId}</a></li>)}</ul>
      {!alert.evidence?.log_ids?.length && <p className="muted">ไม่มี log ID ในหลักฐานที่จัดเก็บ</p>}
      <h3>ข้อมูลหลักฐานและกฎ ณ เวลาที่แจ้งเตือน</h3><pre>{JSON.stringify(alert.evidence ?? {}, null, 2)}</pre>
    </section>}
    {!loading && !id && data && <section className="panel results"><div className="results-title"><h2>รายการแจ้งเตือน</h2><span>{data.data.length} รายการในหน้านี้</span></div>{!data.data.length ? <div className="empty">ไม่พบการแจ้งเตือนตามเงื่อนไขนี้</div> : <div className="table-scroll" tabIndex={0} aria-label="รายการแจ้งเตือน"><table><thead><tr>{['สร้างเมื่อ', 'ชื่อการแจ้งเตือน', 'สถานะ', 'ระดับ', 'IP ต้นทาง', 'จำนวน', 'รายละเอียด'].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead><tbody>{data.data.map(row => <tr key={row.id}><td className="time-cell">{formatDate(row.created_at)}</td><td className="message-cell">{row.title}</td><td><span className={'badge ' + row.status}>{statuses[row.status] || row.status}</span></td><td>{row.severity}</td><td className="mono">{row.src_ip || '—'}</td><td>{row.event_count}</td><td><a href={`#/alerts/${row.id}${query ? '?' + query : ''}`}>เปิดการแจ้งเตือน →</a></td></tr>)}</tbody></table></div>}<Pagination pagination={data.pagination} route={route} /></section>}
  </>
}