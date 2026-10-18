import express from 'express';
import cookieParser from 'cookie-parser';

export const bodyParser = express.json({ limit: '1mb' });
export const cookies = cookieParser();