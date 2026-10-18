export function normalizeCommonJson(input, raw, now = new Date()) {
  const { '@timestamp': timestamp, user, tags, ...fields } = input;
  return {
    ...fields,
    event_timestamp: timestamp ? new Date(timestamp).toISOString() : now.toISOString(),
    actor_user: user ?? null,
    tags: [...new Set([...tags, ...(!timestamp ? ['timestamp_inferred'] : [])])],
    raw,
    normalizer_version: 1,
  };
}