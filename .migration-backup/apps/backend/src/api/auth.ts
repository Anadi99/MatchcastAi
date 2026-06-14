import type { RequestHandler } from 'express';
import { hashApiKey, getApiKey } from '../db/apiKeys';
import type { ApiKey } from '../types/db';

// Extend the Express Request type to carry the resolved ApiKey
declare global {
  namespace Express {
    interface Request {
      apiKey: ApiKey;
    }
  }
}

/**
 * Express middleware that authenticates requests using a Bearer API key.
 *
 * - Extracts the Bearer token from the Authorization header
 * - Hashes it with SHA-256 and looks it up in the api_keys table
 * - Returns 401 if the key is missing, invalid, or inactive
 * - Attaches the resolved ApiKey to req.apiKey on success
 */
export const apiKeyAuth: RequestHandler = async (req, res, next) => {
  const authHeader = req.headers['authorization'];

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const rawKey = authHeader.slice('Bearer '.length).trim();

  if (!rawKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const keyHash = hashApiKey(rawKey);
  const apiKey = await getApiKey(keyHash);

  if (!apiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.apiKey = apiKey;
  next();
};
