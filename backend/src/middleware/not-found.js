export function notFound(request, response) {
  response.status(404).json({ error: { message: 'Route not found' } });
}