import { httpError } from './http-error.js';

// Strict Origin policy for browser/session mutation routes, including future login.
// Do not mount on machine-ingest routes. Postman must supply the configured Origin.
export function csrfProtection(config) {
  return (request, response, next) => {
    if (['GET', 'HEAD', 'OPTIONS'].includes(request.method)) return next();
    if (request.get('origin') !== config.FRONTEND_ORIGIN) return next(httpError(403));
    next();
  };
}