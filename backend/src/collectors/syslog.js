import dgram from 'node:dgram';
import { once } from 'node:events';
import { TextDecoder } from 'node:util';
import { parseSyslog } from '../normalizers/syslog.js';

export async function startSyslogCollector({ host = '127.0.0.1', port = 5514,
  source = 'firewall', allowedSenders = ['127.0.0.1'], url, key,
  maxPending = 100, timeout = 5000, report = () => {} }) {
  const target = new URL(url);
  if (target.username || target.password || target.search || target.hash ||
    !(target.protocol === 'https:' || (target.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(target.hostname)))) {
    throw new Error('Use HTTPS or loopback HTTP without URL credentials');
  }
  if (!key || /\s/.test(key) || !['firewall', 'network'].includes(source) ||
    !Number.isInteger(port) || port < 0 || port > 65535 || !allowedSenders.length ||
    !Number.isInteger(maxPending) || maxPending < 1 || !Number.isInteger(timeout) || timeout < 1) throw new Error('Invalid collector configuration');
  const socket = dgram.createSocket('udp4');
  const pending = new Set();
  const stats = { forwarded: 0, rejected: 0, failed: 0, dropped: 0 };
  let stopping = false;
  const emit = code => { try { report(code); } catch { /* Reporter must not crash ingestion. */ } };
  socket.on('message', (buffer, remote) => {
    if (stopping || pending.size >= maxPending) { stats.dropped++; emit('capacity_drop'); return; }
    let event;
    try {
      if (!allowedSenders.includes(remote.address) || buffer.length > 8192) throw new Error();
      event = parseSyslog(new TextDecoder('utf-8', { fatal: true }).decode(buffer), source);
      event.metadata.collector = { sender_ip: remote.address };
    } catch { stats.rejected++; emit('invalid_or_disallowed_datagram'); return; }
    const task = (async () => {
      try {
        const response = await fetch(target, { method: 'POST', redirect: 'error',
          headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
          body: JSON.stringify(event), signal: AbortSignal.timeout(timeout) });
        await response.body?.cancel();
        if (response.status !== 201) throw new Error();
        stats.forwarded++; emit('forwarded');
      } catch { stats.failed++; emit('forward_failed'); }
    })();
    pending.add(task);
    task.finally(() => pending.delete(task));
  });
  socket.on('error', () => emit('socket_error'));
  const ready = once(socket, 'listening');
  socket.bind(port, host);
  try { await ready; } catch (error) { try { socket.close(); } catch {} throw error; }
  return { address: socket.address(), stats,
    async close() {
      if (stopping) return;
      stopping = true;
      await new Promise(resolve => socket.close(resolve));
      await Promise.allSettled([...pending]);
    },
  };
}