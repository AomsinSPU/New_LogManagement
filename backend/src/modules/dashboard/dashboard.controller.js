export function createDashboardController(service) {
  const handle = method => async (request, response) => {
    response.set('Cache-Control', 'no-store')
      .json(await service[method](request.auth, request.validated.query));
  };
  return { summary: handle('summary'), timeline: handle('timeline') };
}