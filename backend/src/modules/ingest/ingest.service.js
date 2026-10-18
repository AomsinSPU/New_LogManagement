import { normalizeCommonJson } from '../../normalizers/common-json.js';

export function createIngestService(repository) {
  return {
    async ingest(auth, input, raw) {
      const event = normalizeCommonJson(input, raw);
      const log = await repository.insert(auth, event);
      return { data: log };
    },
  };
}