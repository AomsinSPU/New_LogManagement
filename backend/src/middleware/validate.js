import { httpError } from './http-error.js';

// Keep parsed values separate; Express 5 query is a getter.
export function validate(schemas) {
  return async (request, response, next) => {
    const validated = {};
    for (const [part, schema] of Object.entries(schemas)) {
      const result = await schema.safeParseAsync(request[part]);
      if (!result.success) return next(httpError(400));
      validated[part] = result.data;
    }
    request.validated = validated;
    next();
  };
}