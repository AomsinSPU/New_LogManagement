import { httpError } from './http-error.js';

export function authorize(...roles) {
  if (!roles.length || roles.some((role) => !['admin', 'viewer'].includes(role))) {
    throw new Error('Specify valid roles');
  }
  return (request, response, next) => {
    if (!request.auth) return next(httpError(401));
    if (request.auth.type !== 'session' || !roles.includes(request.auth.role)) return next(httpError(403));
    next();
  };
}