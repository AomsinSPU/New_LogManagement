export function createLogsController(service) {
  return {
    async list(request, response) {
      response.json(await service.list(request.auth, request.validated.query));
    },
    async detail(request, response) {
      response.json(await service.detail(request.auth, request.validated.params.id));
    },
  };
}