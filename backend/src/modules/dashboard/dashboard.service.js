export function createDashboardService(repository) {
  return {
    async summary(auth, filter) {
      return { data: await repository.summary(auth.tenant_id, filter),
        range: { from: filter.from, to: filter.to } };
    },
    async timeline(auth, filter) {
      return { data: await repository.timeline(auth.tenant_id, filter),
        range: { from: filter.from, to: filter.to }, interval: filter.interval };
    },
  };
}