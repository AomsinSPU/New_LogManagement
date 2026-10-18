import cors from 'cors';
import { httpError } from './http-error.js';

export function createCors(config) {
  return cors({
    origin(origin, callback) {
      callback(!origin || origin === config.FRONTEND_ORIGIN ? null : httpError(403), true);
    },
    credentials: true,
  });
}