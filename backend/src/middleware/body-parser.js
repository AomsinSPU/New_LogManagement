import express from 'express';
import cookieParser from 'cookie-parser';

export const bodyParser = express.json({ limit: '1mb', verify(request, response, buffer, encoding) {
  // Preserve original JSON text before schema defaults/trimming/normalization.
  // Never retain login/password bodies as raw log records.
  if (request.path === '/ingest' || request.path === '/ingest/') {
    request.rawBody = buffer.toString(encoding);
  }
} });
export const cookies = cookieParser();