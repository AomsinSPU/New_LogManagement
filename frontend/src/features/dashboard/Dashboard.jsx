import { useState } from 'react'
import { useResource } from '../../api/useResource.js'
import { sources } from '../../locales/th.js'
import { formatDate, toApiTime, toThaiInput } from '../../utils/format.js'
import { navigate } from '../../utils/navigation.js'
import { dashboardFilters, defaultRange, logsLink } from './filters.js'

const number = value => Number(value).toLocaleString('th-TH-u-nu-latn')

export default function Dashboard({ route }) {
  const [fallback] = useState(defaultRange)
  let selection
  try { selection = dashboardFilters(route.split('?')[1] || '', fallback) }
  catch (error) { return <section className="panel empty"><h1>ช่วงเวลาไม่ถูกต้อง</h1><p role="alert">{error.message}</p><a href="#/dashboard">กลับช่วงเวลาเริ่มต้น</a></section> }
  return <DashboardContent key={selection.filters.toString()} {...selection} />
}

function DashboardContent({ filters, interval }) {
  const [revision, setRevision] = useState(0), [error, setError] = useState('')
  const summary = useResource('/dashboard/summary?' + filters + '&top=5', revision)
  const timeline = useResource('/dashboard/timeline?' + filters + '&interval=' + interval, revision)
  const loading = summary.loading || timeline.loading
  function submit(event) {
    event.preventDefault()
    const form = new FormData(event.currentTarget), next = new URLSearchParams(filters)
    try {
      next.set('from', toApiTime(form.get('from'))); next.set('to', toApiTime(form.get('to')))
      if (form.get('source')) next.set('source', form.get('source')); else next.delete('source')
      dashboardFilters(next.toString(), {})
      setError(''); navigate('/dashboard?' + next); setRevision(value => value + 1)
    } catch (e) { setError(e.message === 'Invalid time value' ? 'วันเวลาไม่ถูกต้อง' : e.message) }
  }
  function recent(days) {
    const range = defaultRange()
    range.from = new Date(Date.parse(range.to) - days * 86400000).toISOString()
    const next = new URLSearchParams(filters)
    next.set('from', range.from); next.set('to', range.to)
    navigate('/dashboard?' + next); setRevision(value => value + 1)
  }
  const totals = summary.data?.data
  const buckets = timeline.data?.data || []
  const maximum = Math.max(1, ...buckets.map(bucket => bucket.count))
  return <>
    <div className="page-title"><div><p className="eyebrow">ภาพรวมการทำงาน</p><h1>ภาพรวมเหตุการณ์</h1><p>เวลาไทย (UTC+7) · ปี ค.ศ. · จำกัดเฉพาะองค์กรของคุณ</p></div><button className="secondary" disabled={loading} onClick={() => setRevision(value => value + 1)}>↻ รีเฟรช</button></div>
    <form className="panel filters" onSubmit={submit}>
      <label>ตั้งแต่ (เวลาไทย)<input required type="datetime-local" name="from" defaultValue={toThaiInput(filters.get('from'))} /></label>
      <label>ก่อน (เวลาไทย)<input required type="datetime-local" name="to" defaultValue={toThaiInput(filters.get('to'))} /></label>
      <label>แหล่งข้อมูล<select name="source" defaultValue={filters.get('source') || ''}><option value="">ทั้งหมด</option>{Object.entries(sources).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
      <div className="filter-actions"><button className="secondary" type="button" onClick={() => recent(1)}>24 ชั่วโมงล่าสุด</button><button className="secondary" type="button" onClick={() => recent(7)}>7 วันล่าสุด</button><a href="#/dashboard">ล้างตัวกรอง</a><button className="primary" disabled={loading}>ใช้ตัวกรอง</button></div>
      {[...filters].some(([key]) => !['from', 'to', 'source'].includes(key)) && <p className="active-filters">ตัวกรองเพิ่มเติมจาก URL: {[...filters].filter(([key]) => !['from', 'to', 'source'].includes(key)).map(([key, value]) => `${key}=${value}`).join(', ')}</p>}
    </form>
    {error && <div className="error" role="alert">{error}</div>}
    {(summary.error || timeline.error) && <div className="error" role="alert">{summary.error || timeline.error} <button className="secondary" onClick={() => setRevision(value => value + 1)}>ลองใหม่</button></div>}
    <p className="muted">ช่วงข้อมูล: {formatDate(filters.get('from'))} — ก่อน {formatDate(filters.get('to'))}</p>
    {loading && <div className="panel empty" role="status">กำลังโหลดภาพรวม…</div>}
    {!loading && totals && <>
      <div className="metric-grid">{[['เหตุการณ์ทั้งหมด', totals.total, null, ''], ['สำเร็จ', totals.successes, 'success', 'positive'], ['ไม่สำเร็จ', totals.failures, 'failure', 'negative'], ['ไม่ทราบผล', totals.unknown, 'unknown', '']].map(([label, count, outcome, className]) => <a className={`panel metric ${className}`} key={label} href={logsLink(filters, outcome ? { outcome } : {})}><span>{label}</span><strong>{number(count)}</strong><small>ดูบันทึกเหตุการณ์ →</small></a>)}</div>
      {totals.total === 0 && <section className="panel empty"><h2>ไม่พบเหตุการณ์ในช่วงเวลานี้</h2><p>ลองขยายช่วงเวลาหรือเลือกแหล่งข้อมูลอื่น</p></section>}
    </>}
    {!loading && timeline.data && <section className="panel dashboard-section"><div className="results-title"><h2>เหตุการณ์ตามเวลา</h2><span className="muted">{({ minute: 'รายนาที', hour: 'รายชั่วโมง', day: 'รายวัน' })[interval]}</span></div>
      <div className="chart" role="img" aria-label={`กราฟจำนวนเหตุการณ์ ${buckets.length} ช่วงเวลา มีตารางข้อมูลด้านล่าง`}><svg viewBox="0 0 1000 180" preserveAspectRatio="none" aria-hidden="true"><line x1="0" y1="179" x2="1000" y2="179" stroke="#cbd5e1" />{buckets.map((bucket, i) => <rect key={bucket.bucket_start} x={i * 1000 / buckets.length} y={179 - bucket.count / maximum * 160} width={Math.max(.3, 1000 / buckets.length - 1)} height={bucket.count / maximum * 160} fill="#3979ed"><title>{formatDate(bucket.bucket_start)}: {number(bucket.count)}</title></rect>)}</svg></div>
      <div className="chart-labels"><span>{formatDate(filters.get('from'))}</span><span>สูงสุด {number(maximum === 1 && buckets.every(b => b.count === 0) ? 0 : maximum)} เหตุการณ์/ช่วง</span><span>{formatDate(filters.get('to'))}</span></div>
      <details className="timeline-table"><summary>ดูตารางเวลาและเปิดเหตุการณ์ในแต่ละช่วง</summary><div className="table-scroll"><table><thead><tr><th>เริ่มช่วง (ไทย)</th><th>ก่อนสิ้นสุดช่วง (ไทย)</th><th>จำนวน</th></tr></thead><tbody>{buckets.map(bucket => <tr key={bucket.bucket_start}><td>{formatDate(bucket.bucket_start)}</td><td>{formatDate(bucket.bucket_end)}</td><td><a href={logsLink(filters, { from: bucket.bucket_start, to: bucket.bucket_end })}>{number(bucket.count)} →</a></td></tr>)}</tbody></table></div></details>
    </section>}
    {!loading && totals && <div className="top-grid">{[['IP ต้นทางที่พบบ่อย', 'top_ips', 'src_ip'], ['ผู้ใช้ในเหตุการณ์ที่พบบ่อย', 'top_users', 'user'], ['ประเภทเหตุการณ์ที่พบบ่อย', 'top_event_types', 'event_type']].map(([title, field, key]) => <section className="panel dashboard-section" key={field}><h2>{title}</h2><ol className="top-list">{totals[field].map(row => <li key={row.value}><a href={logsLink(filters, { [key]: row.value })}><span>{row.value}</span><strong>{number(row.count)}</strong></a></li>)}</ol>{!totals[field].length && <p className="muted">ไม่มีข้อมูลสำหรับจัดอันดับ</p>}</section>)}</div>}
    {!loading && !summary.error && !timeline.error && <p className="muted">โหลดข้อมูลครบเมื่อ {formatDate([summary.updated, timeline.updated].sort().at(-1))} · <a href={logsLink(filters)}>เปิด Logs ด้วยช่วงเวลาเดียวกัน →</a></p>}
  </>
}