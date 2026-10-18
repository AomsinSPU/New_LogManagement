export function createKeyController(service) {
  return {
    async create(request, response) {
      response.status(201).json(await service.create(request.auth, request.validated.body));
    },
    async list(request, response) {
      response.json(await service.list(request.auth, request.validated.query));
    },
    async revoke(request, response) {
      await service.revoke(request.auth, request.validated.params.id);
      response.status(204).end();
    },
  };
}