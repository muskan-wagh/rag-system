import { describe, it, expect } from 'vitest';
import express from 'express';
import request from 'supertest';
import { apiNotFoundHandler, notFoundHandler } from '@/middleware/notFound';
import { errorHandler } from '@/middleware/errorHandler';

/**
 * Regression: unmatched API routes must answer with JSON.
 *
 * The deployed workspace failed with `Unexpected token '<', "<!DOCTYPE "... is
 * not valid JSON` because `GET /api/jobs/:jobId/workspace` did not exist on the
 * running backend build, Express answered with its default HTML 404 page, and
 * the frontend called `res.json()` unconditionally.
 *
 * Two things are therefore locked in here:
 *   1. an unmatched /api route never returns HTML, and
 *   2. a route that DOES exist but throws still produces a JSON error rather
 *      than falling through to the 404 handler.
 */
function makeApp() {
  const app = express();
  app.use(express.json());
  app.get('/api/ok', (_req, res) => {
    res.json({ success: true, data: { ok: true } });
  });
  app.get('/api/boom', () => {
    throw new Error('deliberate failure');
  });

  // Same ordering as src/server.ts: error handlers first, then the 404s.
  app.use(errorHandler);
  app.use('/api', apiNotFoundHandler);
  app.use(notFoundHandler);
  return app;
}

describe('API 404 contract', () => {
  const app = makeApp();

  it('answers an unmatched /api route with JSON, not HTML', async () => {
    const res = await request(app).get('/api/jobs/some-job-id/workspace');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.text).not.toMatch(/<!DOCTYPE html>/i);
    expect(res.body).toMatchObject({ success: false, code: 'NOT_FOUND' });
    expect(typeof res.body.error).toBe('string');
  });

  it('names the missing route so a stale deployment is diagnosable', async () => {
    const res = await request(app).get('/api/jobs/abc/workspace');

    expect(res.body.error).toContain('/api/jobs/abc/workspace');
    expect(res.body.error).toContain('not be deployed');
  });

  it('reports every HTTP method on an unmatched route as JSON', async () => {
    for (const method of ['post', 'patch', 'delete', 'put'] as const) {
      const res = await (request(app) as unknown as Record<string, (p: string) => request.Test>)[
        method
      ]('/api/does/not/exist');
      expect(res.status).toBe(404);
      expect(res.headers['content-type']).toMatch(/application\/json/);
      expect(res.text).not.toMatch(/<!DOCTYPE html>/i);
    }
  });

  it('keeps a matched route working', async () => {
    const res = await request(app).get('/api/ok');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ success: true, data: { ok: true } });
  });

  it('returns JSON for a matched route that throws, not a 404', async () => {
    const res = await request(app).get('/api/boom');

    expect(res.status).toBe(500);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.body).toMatchObject({ success: false, code: 'INTERNAL_ERROR' });
    // The internal message must not leak to the client.
    expect(res.text).not.toContain('deliberate failure');
  });

  it('answers non-API paths with JSON too', async () => {
    const res = await request(app).get('/not-an-api-path');

    expect(res.status).toBe(404);
    expect(res.headers['content-type']).toMatch(/application\/json/);
    expect(res.text).not.toMatch(/<!DOCTYPE html>/i);
  });
});