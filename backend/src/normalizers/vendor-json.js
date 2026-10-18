import { z } from 'zod';
import { isIP } from 'node:net';
import { ingestSchema } from '../modules/ingest/ingest.schema.js';

const timestamp = z.string().datetime({ offset: true });
const str = z.string().min(1);
const vendorSchemas = {
  ad: z.object({ EventID: z.union([z.literal(4624), z.literal(4625)]),
    TimeCreated: timestamp.optional(), TargetUserName: str.optional(), IpAddress: str.optional(), Computer: str.optional() }).passthrough(),
  aws: z.object({ eventName: str, eventTime: timestamp.optional(), eventSource: str.optional(),
    sourceIPAddress: str.optional(), awsRegion: str.optional(), recipientAccountId: str.optional(),
    eventID: str.optional(), errorCode: str.optional(),
    userIdentity: z.object({ userName: str.optional(), arn: str.optional(), accountId: str.optional() }).passthrough().optional(),
    responseElements: z.record(z.string(), z.unknown()).nullable().optional() }).passthrough(),
  m365: z.object({ Operation: str, CreationTime: str.optional(), UserId: str.optional(),
    ClientIP: str.nullable().optional(), ResultStatus: str.optional(), Workload: str.optional(), Id: str.optional() }).passthrough(),
  // Deliberately a documented synthetic fixture shape, NOT every Falcon export schema.
  crowdstrike: z.object({ event_type: z.literal('DetectionSummary'), timestamp: timestamp.optional(),
    detection_name: str, severity: z.number().int().min(0).max(10),
    user: str.optional(), host: str.optional(), ip: str.optional(), process: str.optional() }).passthrough(),
};

export const vendorEnvelopeSchema = z.object({
  format: z.literal('vendor'), source: z.enum(['ad', 'aws', 'm365', 'crowdstrike']),
  data: z.record(z.string(), z.unknown()),
}).strict();

export function parseRecord(record) {
  if (record?.format !== 'vendor') return ingestSchema.safeParse(record);
  const envelope = vendorEnvelopeSchema.safeParse(record);
  if (!envelope.success) return envelope;
  const { source, data } = envelope.data;
  // Never interpret tenant fields in a payload as local authorization.
  if ('tenant_id' in data || 'ingest_key_id' in data) return { success: false };
  const parsed = vendorSchemas[source].safeParse(data);
  if (!parsed.success) return parsed;
  const d = parsed.data;
  let event;
  if (source === 'ad') {
    const failed = d.EventID === 4625;
    event = { event_type: 'authentication', event_subtype: failed ? 'login_failed' : 'login_success',
      action: 'login', outcome: failed ? 'failure' : 'success', severity: failed ? 5 : 1,
      '@timestamp': d.TimeCreated, user: d.TargetUserName, host: d.Computer,
      message: failed ? 'Windows login failed' : 'Windows login succeeded', ip: d.IpAddress,
      vendor: 'Microsoft', product: 'Windows Security' };
  } else if (source === 'aws') {
    const login = d.eventName === 'ConsoleLogin';
    const loginResult = d.responseElements?.ConsoleLogin;
    event = { event_type: login ? 'authentication' : 'cloud_activity', event_subtype: d.eventName,
      action: login ? 'login' : undefined,
      outcome: d.errorCode || loginResult === 'Failure' ? 'failure' : loginResult === 'Success' ? 'success' : 'unknown',
      '@timestamp': d.eventTime, user: d.userIdentity?.userName ?? d.userIdentity?.arn,
      source_event_id: d.eventID, message: `AWS ${d.eventName}`, ip: d.sourceIPAddress,
      vendor: 'AWS', product: 'CloudTrail' };
  } else if (source === 'm365') {
    let time = d.CreationTime;
    // CreationTime is UTC; accept zone-less ISO exports explicitly as UTC.
    if (time && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?$/.test(time)) time += 'Z';
    const login = ['UserLoggedIn', 'UserLoginFailed'].includes(d.Operation);
    const result = d.ResultStatus?.toLowerCase();
    event = { event_type: login ? 'authentication' : 'audit_activity', event_subtype: d.Operation,
      action: login ? 'login' : undefined,
      outcome: d.Operation === 'UserLoginFailed' || ['failed', 'failure'].includes(result)
        ? 'failure' : login ? (result === 'success' ? 'success' : 'unknown')
          : ['success', 'succeeded'].includes(result) ? 'success' : 'unknown',
      '@timestamp': time, user: d.UserId, source_event_id: d.Id, ip: d.ClientIP,
      message: `Microsoft 365 ${d.Operation}`, vendor: 'Microsoft', product: d.Workload ?? 'Microsoft 365' };
  } else {
    event = { event_type: 'threat_detection', event_subtype: 'DetectionSummary', action: 'alert',
      outcome: 'unknown', severity: d.severity, '@timestamp': d.timestamp,
      user: d.user, host: d.host, ip: d.ip, message: d.detection_name, vendor: 'CrowdStrike', product: 'Synthetic sample' };
  }
  const { ip, ...fields } = event;
  return ingestSchema.safeParse({ ...fields, source, src_ip: typeof ip === 'string' && isIP(ip) ? ip : undefined,
    metadata: { original: data }, tags: ['vendor_json', ...(ip && !isIP(ip) ? ['non_ip_source_address'] : [])] });
}

// Output is already validated common schema for existing authorization and service code.
export const incomingRecordSchema = z.unknown().transform((value, context) => {
  const result = parseRecord(value);
  if (!result.success) { context.addIssue({ code: 'custom', message: 'Invalid or unsupported event' }); return z.NEVER; }
  return result.data;
});