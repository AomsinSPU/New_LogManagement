import { ingestSchema } from '../modules/ingest/ingest.schema.js';

// RFC5424 subset: version 1, NILVALUE structured data, UTF-8 MSG.
// The optional MSG key=value syntax below is our demo format, not a vendor contract.
export function parseSyslog(raw, source = 'firewall') {
  if (!['firewall', 'network'].includes(source)) throw new Error('Invalid configured source');
  if (typeof raw !== 'string' || Buffer.byteLength(raw) > 8192 || /[\u0000\r\n]/.test(raw)) throw new Error('Invalid datagram');
  const m = /^<(\d{1,3})>1 (\S+) ([!-~]{1,255}) ([!-~]{1,48}) ([!-~]{1,128}) ([!-~]{1,32}) -(?: (.*))?$/.exec(raw);
  if (!m || Number(m[1]) > 191) throw new Error('Unsupported syslog format');
  const [, pri, timestamp, host, app, procid, msgid, message = ''] = m;
  const values = Object.create(null);
  for (const token of message.split(/\s+/)) {
    const field = /^(src_ip|dst_ip|src_port|dst_port|protocol|action|user)=([^\s=]+)$/.exec(token);
    if (field) {
      if (Object.hasOwn(values, field[1])) throw new Error('Duplicate field');
      values[field[1]] = field[2];
    }
  }
  for (const key of ['src_port', 'dst_port']) if (values[key] !== undefined) {
    if (!/^\d{1,5}$/.test(values[key])) throw new Error('Invalid port');
    values[key] = Number(values[key]);
  }
  const priority = Number(pri);
  return ingestSchema.parse({ source, ...values,
    '@timestamp': timestamp === '-' ? undefined : timestamp,
    host: host === '-' ? undefined : host,
    product: app === '-' ? undefined : app,
    event_type: 'network_connection', outcome: 'unknown',
    severity: [10, 9, 8, 7, 5, 3, 1, 0][priority % 8],
    message: message || undefined,
    tags: ['syslog'],
    metadata: { syslog: { priority, facility: Math.floor(priority / 8), severity: priority % 8,
      app, procid, msgid, raw } },
  });
}