export function errorHandler(error, request, response, next) {
  if (response.headersSent) return next(error);
  const status = Number.isInteger(error.status) && error.status >= 400 && error.status < 500
    ? error.status : 500;
  const messages = {
    400: 'Invalid request', 401: 'Authentication required', 403: 'Request forbidden',
    409: 'Request conflict', 413: 'Request body too large', 415: 'Unsupported content type',
    429: 'Too many requests',
  };
  if (status === 500) console.error('An unexpected request error occurred.');
  response.status(status).json({ error: {
    message: messages[status] ?? (status === 500 ? 'Internal server error' : 'Request rejected'),
  } });
}