// Built frontend + isolated Edge profile + synthetic API. No real backend requests or credentials.
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, extname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'
import { once } from 'node:events'

const root = fileURLToPath(new URL('../dist/', import.meta.url))
const profile = await mkdtemp(join(tmpdir(), 'logmanage-smoke-'))
const server = createServer(async (req, res) => {
  try {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname))
    if (!file.startsWith(root)) { res.writeHead(403).end(); return }
    const body = await readFile(file)
    res.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' })[extname(file)] || 'application/octet-stream')
    res.end(body)
  } catch { res.writeHead(404).end() }
})
server.listen(0, '127.0.0.1'); await once(server, 'listening')
const browser = spawn(process.env.EDGE_PATH || 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=0', `--user-data-dir=${profile}`, 'about:blank',
], { stdio: 'ignore' })
let startupError
browser.on('error', error => { startupError = error })
let socket, sequence = 0
const pending = new Map(), errors = []
const pause = ms => new Promise(resolve => setTimeout(resolve, ms))
async function waitFor(check, label) {
  for (let i = 0; i < 100; i++) { if (await check()) return; await pause(100) }
  throw new Error('Timeout: ' + label)
}
function send(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++sequence
    const timer = setTimeout(() => { pending.delete(id); reject(new Error('CDP timeout: ' + method)) }, 10000)
    pending.set(id, { resolve: result => { clearTimeout(timer); resolve(result) }, reject: error => { clearTimeout(timer); reject(error) } })
    socket.send(JSON.stringify({ id, method, params }))
  })
}
async function evaluate(expression) {
  const result = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true })
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text)
  return result.result.value
}
const visible = text => waitFor(() => evaluate(`document.body.innerText.includes(${JSON.stringify(text)})`), text)
const clickText = text => evaluate(`[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim()===${JSON.stringify(text)}).click()`)

// Injected before app code. sessionStorage is used only by this fixture, never production auth.
function fixture() {
  window.__requests = []; window.__mode = 'normal'
  window.confirm = () => window.__confirm !== false
  const rules = [{ id: '22222222-2222-4222-8222-222222222222', name: 'Fixture rule', description: null, threshold: 5, window_seconds: 300, cooldown_seconds: 300, severity: 5, is_enabled: true, rule_type: 'failed_login_threshold' }]
  const alert = { id: '33333333-3333-4333-8333-333333333333', title: 'Fixture alert', status: 'open', severity: 5, src_ip: '10.0.0.1', event_count: 8, created_at: '2026-10-19T03:00:00Z', window_start: '2026-10-19T02:55:00Z', window_end: '2026-10-19T03:00:00Z', rule_id: rules[0].id, evidence: { sampled: true, log_ids: ['11111111-1111-4111-8111-111111111111', '44444444-4444-4444-8444-444444444444'], rule: { threshold: 5 } } }
  const id = '11111111-1111-4111-8111-111111111111'
  const batches = []
  const keys = []
  const log = { id, event_timestamp: '2026-10-19T03:00:00Z', ingested_at: '2026-10-19T03:01:00Z', source: 'aws', event_type: 'login', outcome: 'failure', severity: 4, message: 'Fixture event', src_ip: '10.0.0.1', actor_user: 'fixture', metadata: {}, raw: { sample: '<script>unsafe</script>' } }
  window.fetch = async (input, options = {}) => {
    const url = new URL(input, location.origin), p = url.pathname, query = url.searchParams
    window.__requests.push({ path: p, query: url.search, credentials: options.credentials, method: options.method, body: options.body })
    const reply = (data, status = 200) => Promise.resolve(new Response(status === 204 ? null : JSON.stringify(data), { status, headers: { 'Content-Type': 'application/json' } }))
    if (p === '/auth/login') {
      const body = JSON.parse(options.body)
      if (body.password !== 'fixture-only') return reply({}, 401)
      sessionStorage.setItem('fixture-session', 'yes')
    }
    if (p === '/auth/logout') { sessionStorage.removeItem('fixture-session'); return reply(null, 204) }
    if (!sessionStorage.getItem('fixture-session') || window.__mode === 'expired') return reply({}, 401)
    if (p === '/auth/login' || p === '/auth/me') return reply({ user: { id: 'fixture', email: 'fixture@example.com', display_name: 'ผู้ทดสอบ', role: sessionStorage.getItem('fixture-role') || 'viewer', tenant: { name: 'องค์กรทดสอบ' } } })
    if (window.__mode === 'error') return reply({}, 500)
    if (p === '/ingest-keys' || p.startsWith('/ingest-keys/')) {
      if (sessionStorage.getItem('fixture-role') !== 'admin') return reply({}, 403)
      if (p === '/ingest-keys' && options.method === 'POST') {
        if (window.__mode === 'uncertain') throw new TypeError('Fixture network failure')
        const key = { id: '88888888-8888-4888-8888-888888888888', ...JSON.parse(options.body), key_prefix: 'fixture-', created_at: '2026-10-19T03:00:00Z', revoked_at: null, last_used_at: null }
        keys.push(key); return reply({ key, secret: 'fixture-secret-not-a-real-key' }, 201)
      }
      if (p === '/ingest-keys') return reply({ data: keys, pagination: { limit: 20, offset: 0, has_more: false } })
      const key = keys.find(row => p === '/ingest-keys/' + row.id)
      if (key && options.method === 'DELETE') { key.revoked_at = '2026-10-19T04:00:00Z'; return reply(null, 204) }
      return reply({}, 404)
    }
    if (p === '/imports' || p.startsWith('/imports/')) {
      if (sessionStorage.getItem('fixture-role') !== 'admin') return reply({}, 403)
      if (p === '/imports' && options.method === 'POST') {
        const body = JSON.parse(options.body)
        if (window.__mode === 'uncertain') throw new TypeError('Fixture network failure')
        const failed = body.records.every(record => !record?.event_type)
        const row = { id: failed ? '77777777-7777-4777-8777-777777777777' : '66666666-6666-4666-8666-666666666666', filename: body.filename, source: body.source, status: failed ? 'failed' : 'partial', total_count: body.records.length, accepted_count: failed ? 0 : 1, rejected_count: failed ? body.records.length : body.records.length - 1, error_summary: [{ index: failed ? 0 : 1, message: 'Invalid or unsupported record' }], created_at: '2026-10-19T03:00:00Z', completed_at: '2026-10-19T03:00:01Z', submitted_by: 'fixture' }
        batches.push(row); return reply({ data: row }, 201)
      }
      if (p === '/imports') return reply({ data: batches.filter(row => (!query.get('source') || row.source === query.get('source')) && (!query.get('status') || row.status === query.get('status'))).slice(Number(query.get('offset') || 0)), pagination: { limit: 20, offset: Number(query.get('offset') || 0), has_more: false } })
      const row = batches.find(batch => p === '/imports/' + batch.id)
      return row ? reply({ data: row }) : reply({}, 404)
    }
    if (p.startsWith('/alerts') || p.startsWith('/alert-rules')) {
      const method = options.method || 'GET', admin = sessionStorage.getItem('fixture-role') === 'admin'
      if (method !== 'GET' && !admin) return reply({}, 403)
      if (method !== 'GET' && window.__mode === 'conflict') return reply({}, 409)
      if (p === '/alerts') return reply({ data: window.__mode === 'empty' || (query.get('status') && query.get('status') !== alert.status) ? [] : [alert], pagination: { limit: 20, offset: Number(query.get('offset') || 0), has_more: false } })
      if (p === '/alerts/' + alert.id) {
        if (method === 'PATCH') { if (alert.status === 'resolved') return reply({}, 409); Object.assign(alert, JSON.parse(options.body)) }
        return reply({ data: alert })
      }
      if (p === '/alert-rules') {
        if (method === 'POST') { const row = { id: '55555555-5555-4555-8555-555555555555', ...JSON.parse(options.body) }; rules.push(row); return reply({ data: row }, 201) }
        return reply({ data: rules, pagination: { limit: 20, offset: 0, has_more: false } })
      }
      const rule = rules.find(row => p === '/alert-rules/' + row.id)
      if (rule && method === 'PATCH') { Object.assign(rule, JSON.parse(options.body)); return reply({ data: rule }) }
      return reply({}, 404)
    }
    if (p === '/dashboard/summary') return reply({ data: { total: 3, successes: 1, failures: 2, unknown: 0, top_ips: [{ value: '10.0.0.1', count: 3 }], top_users: [{ value: 'fixture', count: 3 }], top_event_types: [{ value: 'login', count: 3 }] } })
    if (p === '/dashboard/timeline') return reply({ data: [{ bucket_start: query.get('from'), bucket_end: query.get('to'), count: 3 }] })
    if (p === '/logs') return reply({ data: window.__mode === 'empty' ? [] : [log], pagination: { limit: 20, offset: Number(query.get('offset') || 0), has_more: !query.get('offset') } })
    if (p === '/logs/' + id) return reply({ data: log })
    return reply({}, 404)
  }
}

try {
  let port
  await waitFor(async () => { if (startupError) throw startupError; try { port = (await readFile(join(profile, 'DevToolsActivePort'), 'utf8')).split('\n')[0]; return !!port } catch { return false } }, 'Edge startup')
  const targets = await (await fetch(`http://127.0.0.1:${port}/json/list`)).json()
  socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl)
  await once(socket, 'open')
  socket.addEventListener('message', ({ data }) => {
    const message = JSON.parse(data)
    if (message.id && pending.has(message.id)) {
      const handler = pending.get(message.id); pending.delete(message.id)
      if (message.error) handler.reject(new Error(message.error.message)); else handler.resolve(message.result)
    } else if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails.text)
  })
  await send('Runtime.enable'); await send('Page.enable')
  await send('Page.addScriptToEvaluateOnNewDocument', { source: `(${fixture.toString()})()` })
  await send('Page.navigate', { url: `http://127.0.0.1:${server.address().port}/` })
  await visible('เข้าสู่ระบบ')
  await evaluate(`document.querySelector('[name=email]').value='fixture@example.com'; document.querySelector('[name=password]').value='wrong'; document.querySelector('form').requestSubmit()`)
  await visible('ข้อมูลเข้าสู่ระบบไม่ถูกต้อง')
  await evaluate(`document.querySelector('[name=password]').value='fixture-only'; document.querySelector('form').requestSubmit()`)
  await visible('IP ต้นทางที่พบบ่อย'); await visible('องค์กรทดสอบ')
  const requests = await evaluate('window.__requests')
  const summary = new URLSearchParams(requests.find(r => r.path === '/dashboard/summary').query)
  const timeline = new URLSearchParams(requests.find(r => r.path === '/dashboard/timeline').query)
  assert.equal(summary.get('from'), timeline.get('from')); assert.equal(summary.get('to'), timeline.get('to'))
  assert.ok(requests.every(r => r.credentials === 'include'))
  await send('Page.reload'); await visible('IP ต้นทางที่พบบ่อย')
  await evaluate(`location.hash='/imports'`); await visible('ไม่มีสิทธิ์เข้าหน้านำเข้า')
  assert.equal(await evaluate(`window.__requests.some(r=>r.path.startsWith('/imports'))`), false)
  await evaluate(`location.hash='/ingest-keys'`); await visible('ไม่มีสิทธิ์จัดการกุญแจรับข้อมูล')
  assert.equal(await evaluate(`window.__requests.some(r=>r.path.startsWith('/ingest-keys'))`), false)
  await evaluate(`location.hash='/alerts'`); await visible('Fixture alert')
  await clickText('เปิดการแจ้งเตือน →'); await visible('หลักฐานเหตุการณ์')
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(e=>e.textContent==='รับทราบการแจ้งเตือน')`), false)
  await evaluate(`document.querySelectorAll('.evidence-list a')[1].click()`); await visible('ไม่พบข้อมูลในองค์กรของคุณ')
  await evaluate(`location.hash='/alert-rules'`); await visible('Fixture rule')
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(e=>['สร้างกฎ','แก้ไขกฎ'].includes(e.textContent))`), false)
  await evaluate(`location.hash='/dashboard'`); await visible('IP ต้นทางที่พบบ่อย')
  await evaluate(`document.querySelector('.top-list a').click()`)
  await visible('Fixture event')
  assert.equal(await evaluate(`new URLSearchParams(location.hash.split('?')[1]).get('src_ip')`), '10.0.0.1')
  const logsHash = await evaluate('location.hash')
  await clickText('ดูรายละเอียด →'); await visible('ข้อมูลต้นฉบับ')
  assert.ok(await evaluate(`document.querySelector('pre:last-child').textContent.includes('<script>unsafe</script>')`))
  await clickText('← กลับรายการ'); await visible('Fixture event')
  assert.equal(await evaluate('location.hash'), logsHash)
  await clickText('ถัดไป'); await visible('เริ่มที่รายการ 21')
  await clickText('ก่อนหน้า'); await visible('เริ่มที่รายการ 1')
  await evaluate(`window.__mode='empty'`); await clickText('↻ รีเฟรช'); await visible('ไม่พบเหตุการณ์')
  await evaluate(`window.__mode='error'`); await clickText('↻ รีเฟรช'); await visible('ระบบขัดข้อง')
  await evaluate(`window.__mode='normal'`); await clickText('ลองใหม่'); await visible('Fixture event')
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 1, mobile: true })
  await clickText('เมนู'); assert.equal(await evaluate(`document.querySelector('.menu-button').getAttribute('aria-expanded')`), 'true')
  await clickText('▥ ภาพรวม'); await visible('IP ต้นทางที่พบบ่อย')
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  await evaluate(`window.__mode='expired'`); await clickText('↻ รีเฟรช'); await visible('เซสชันหมดอายุ')
  await waitFor(() => evaluate(`!document.querySelector('button.primary')?.disabled`), 'login ready')
  await evaluate(`window.__mode='normal'; sessionStorage.setItem('fixture-role','admin'); document.querySelector('[name=email]').value='fixture@example.com'; document.querySelector('[name=password]').value='fixture-only'; document.querySelector('form').requestSubmit()`)
  await visible('IP ต้นทางที่พบบ่อย'); await clickText('เมนู'); await visible('ผู้ดูแลระบบ')
  await evaluate(`location.hash='/alerts?status=open'`); await visible('Fixture alert')
  await clickText('เปิดการแจ้งเตือน →'); await visible('รับทราบการแจ้งเตือน')
  await evaluate(`window.__confirm=false`); await clickText('รับทราบการแจ้งเตือน')
  assert.equal(await evaluate(`window.__requests.filter(r=>r.path.startsWith('/alerts/') && r.method==='PATCH').length`), 0)
  await evaluate(`window.__confirm=true; window.__mode='conflict'`); await clickText('รับทราบการแจ้งเตือน'); await visible('สถานะขัดแย้ง')
  await evaluate(`window.__mode='normal'`); await clickText('โหลดสถานะล่าสุด'); await visible('รับทราบการแจ้งเตือน')
  await clickText('รับทราบการแจ้งเตือน'); await visible('รับทราบแล้ว')
  await clickText('ปิดการแจ้งเตือน'); await visible('การแจ้งเตือนนี้ปิดแล้ว')
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].some(e=>e.textContent==='รับทราบการแจ้งเตือน')`), false)
  await clickText('← กลับการแจ้งเตือน'); await visible('ไม่พบการแจ้งเตือนตามเงื่อนไขนี้')
  await evaluate(`location.hash='/alert-rules'`); await visible('Fixture rule')
  await clickText('สร้างกฎ'); await visible('สร้างกฎการแจ้งเตือน')
  await evaluate(`document.querySelector('[name=name]').value='New fixture rule'`)
  await clickText('บันทึกกฎ'); await visible('New fixture rule')
  assert.equal(await evaluate(`window.__requests.filter(r=>r.path==='/alert-rules' && r.method==='POST').length`), 1)
  await clickText('แก้ไขกฎ'); await visible('แก้ไขกฎการแจ้งเตือน')
  await evaluate(`document.querySelector('[name=is_enabled]').click(); document.querySelector('[name=threshold]').value='7'`)
  await clickText('บันทึกกฎ'); await visible('ปิดใช้งาน')
  const patch = await evaluate(`JSON.parse(window.__requests.findLast(r=>r.path.startsWith('/alert-rules/') && r.method==='PATCH').body)`)
  assert.deepEqual(patch, { is_enabled: false, threshold: 7 })
  assert.equal(await evaluate('document.documentElement.scrollWidth <= innerWidth'), true)
  await evaluate(`location.hash='/imports'`); await visible('นำเข้าไฟล์ JSON')
  await visible('ไม่พบประวัติตามเงื่อนไขนี้')
  async function chooseJson(content) {
    await evaluate(`(() => { const transfer = new DataTransfer(); transfer.items.add(new File([${JSON.stringify(content)}], 'fixture.json', {type:'application/json'})); const input = document.querySelector('input[type=file]'); input.files = transfer.files; input.dispatchEvent(new Event('change',{bubbles:true})); })()`)
  }
  await chooseJson('{'); await visible('ไฟล์ไม่ใช่ JSON ที่ถูกต้อง')
  await chooseJson(JSON.stringify({ source: 'api', records: [{ source: 'api', event_type: 'authentication' }, {}] })); await visible('พร้อมส่ง:')
  await evaluate(`window.__confirm=false`); await clickText('ยืนยันนำเข้า')
  assert.equal(await evaluate(`window.__requests.filter(r=>r.path==='/imports' && r.method==='POST').length`), 0)
  await evaluate(`window.__confirm=true`); await clickText('ยืนยันนำเข้า'); await visible('ผลการนำเข้า: สำเร็จบางส่วน')
  await visible('Invalid or unsupported record')
  assert.equal(await evaluate(`document.querySelector('button.primary').disabled`), true)
  await clickText('ดู batch →'); await visible('รายละเอียดการนำเข้า')
  await clickText('เปิด Logs ของ batch นี้ →'); await visible('Fixture event')
  assert.equal(await evaluate(`new URLSearchParams(location.hash.split('?')[1]).get('batch_id')`), '66666666-6666-4666-8666-666666666666')
  await evaluate(`location.hash='/imports?status=failed'`); await visible('ไม่พบประวัติตามเงื่อนไขนี้')
  await chooseJson(JSON.stringify({ source: 'api', records: [null] })); await visible('พร้อมส่ง:')
  await clickText('ยืนยันนำเข้า'); await visible('ผลการนำเข้า: ไม่สำเร็จ')
  await chooseJson(JSON.stringify({ source: 'api', records: [{}] })); await visible('พร้อมส่ง:')
  await evaluate(`window.__mode='uncertain'`); await clickText('ยืนยันนำเข้า'); await visible('ยังยืนยันผลการนำเข้าไม่ได้')
  assert.equal(await evaluate(`document.querySelector('input[type=file]').disabled`), true)
  assert.equal(await evaluate(`window.__requests.filter(r=>r.path==='/imports' && r.method==='POST').length`), 3)
  await evaluate(`window.__mode='normal'`)
  await evaluate(`location.hash='/ingest-keys'`); await visible('ยังไม่มีกุญแจรับข้อมูล')
  await clickText('สร้างกุญแจ'); await visible('สร้างกุญแจรับข้อมูล')
  await evaluate(`document.querySelector('[name=name]').value='Fixture key'`)
  await clickText('ยืนยันสร้างกุญแจ'); await visible('เลือกแหล่งข้อมูลอย่างน้อยหนึ่งรายการ')
  await evaluate(`document.querySelector('[name=allowed_sources][value=api]').click(); window.__confirm=false`)
  await clickText('ยืนยันสร้างกุญแจ')
  assert.equal(await evaluate(`window.__requests.filter(r=>r.path==='/ingest-keys' && r.method==='POST').length`), 0)
  await evaluate(`window.__confirm=true`); await clickText('ยืนยันสร้างกุญแจ'); await visible('แสดง secret หลังสร้างเท่านั้น')
  assert.equal(await evaluate(`document.querySelector('.secret-panel input').value`), 'fixture-secret-not-a-real-key')
  assert.equal(await evaluate(`JSON.stringify(localStorage).includes('fixture-secret') || JSON.stringify(sessionStorage).includes('fixture-secret') || location.href.includes('fixture-secret')`), false)
  await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText:async text=>{window.__clipboard=text}} })`)
  await clickText('คัดลอก secret'); await visible('คัดลอกแล้ว — clipboard')
  assert.equal(await evaluate(`window.__clipboard`), 'fixture-secret-not-a-real-key')
  await evaluate(`Object.defineProperty(navigator, 'clipboard', { configurable:true, value:{writeText:async()=>{throw new Error('Fixture clipboard denied')}} })`)
  await clickText('คัดลอก secret'); await visible('คัดลอกอัตโนมัติไม่ได้')
  await clickText('เก็บแล้ว ปิด secret')
  assert.equal(await evaluate(`document.querySelector('.secret-panel')===null`), true)
  await clickText('↻ รีเฟรช'); await visible('Fixture key')
  assert.equal(await evaluate(`document.querySelector('.secret-panel')===null`), true)
  await evaluate(`window.__confirm=false`); await clickText('เพิกถอนกุญแจ')
  assert.equal(await evaluate(`window.__requests.some(r=>r.path.startsWith('/ingest-keys/') && r.method==='DELETE')`), false)
  await evaluate(`window.__confirm=true`); await clickText('เพิกถอนกุญแจ'); await visible('เพิกถอนกุญแจเรียบร้อย'); await visible('เพิกถอนแล้ว')
  await clickText('สร้างกุญแจ'); await evaluate(`document.querySelector('[name=name]').value='Uncertain fixture'; document.querySelector('[name=allowed_sources][value=api]').click(); window.__mode='uncertain'`)
  await clickText('ยืนยันสร้างกุญแจ'); await visible('ไม่ทราบผลการสร้าง')
  assert.equal(await evaluate(`[...document.querySelectorAll('button')].find(e=>e.textContent==='ยืนยันสร้างกุญแจ').matches(':disabled')`), true)
  await evaluate(`window.__mode='normal'`); await clickText('ปิดฟอร์มสร้างกุญแจ')
  await clickText('ออกจากระบบ'); await visible('ออกจากระบบแล้ว')
  assert.deepEqual(errors, [])
  console.log('PASS: isolated browser smoke — auth, dashboard, logs, mobile, role guards, alerts/rules, imports, ingest-key create/copy/copy-failure/dismiss/revoke/uncertain creation, secret storage checks, logout; no runtime exceptions.')
} catch (error) {
  console.error('Fixture browser screen:', await evaluate('document.body.innerText').catch(() => 'unavailable'))
  throw error
} finally {
  if (socket?.readyState === WebSocket.OPEN) { await send('Browser.close').catch(() => {}); socket.close() }
  browser.kill(); server.closeAllConnections(); await new Promise(resolve => server.close(resolve))
  await pause(700)
  await rm(profile, { recursive: true, force: true, maxRetries: 5, retryDelay: 300 }).catch(() => console.warn('Temporary Edge profile could not be removed:', profile))
}