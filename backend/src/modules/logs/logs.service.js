import { httpError } from '../../middleware/http-error.js';

export function createLogsService(repository) {
  return {
    async list(auth, filter) {
      const rows = await repository.list(auth.tenant_id, filter);
      return { data: rows.slice(0, filter.limit), pagination: {
        limit: filter.limit, offset: filter.offset, has_more: rows.length > filter.limit,
      } };
    },
    async detail(auth, id) {
      const log = await repository.detail(auth.tenant_id, id);
      if (!log) throw httpError(404);
      return { data: log };
    },
  };
}