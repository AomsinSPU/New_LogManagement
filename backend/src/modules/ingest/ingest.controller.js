export function createIngestController(service) {
  return async (request, response) => {
    const result = await service.ingest(request.auth, request.validated.body, request.rawBody);
    response.set('Cache-Control', 'no-store').status(201).json(result);
  };
}