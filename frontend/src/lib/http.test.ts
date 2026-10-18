import { describe, it, expect } from 'vitest';
import { ApiRequestError, readApiResponse, toReadableError } from '@/lib/http';

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlResponse(body: string, status = 404): Response {
  return new Response(body, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

const EXPRESS_404 = `<!DOCTYPE html>
<html lang="en">
<head><meta charset="utf-8"><title>Error</title></head>
<body><pre>Cannot GET /api/jobs/x/workspace</pre></body>
</html>`;

describe('readApiResponse', () => {
  it('parses a successful JSON envelope', async () => {
    const res = jsonResponse({ success: true, data: { id: 'job-1' } });
    await expect(readApiResponse(res, '/jobs/job-1/workspace')).resolves.toEqual({
      success: true,
      data: { id: 'job-1' },
    });
  });

  it('returns the error envelope for a JSON failure so callers keep their shape', async () => {
    const res = jsonResponse({ success: false, error: 'Job not found' }, 404);
    await expect(readApiResponse(res, '/jobs/x/workspace')).resolves.toEqual({
      success: false,
      error: 'Job not found',
    });
  });

  it('never throws a SyntaxError on an HTML 404 (the deployed failure)', async () => {
    const res = htmlResponse(EXPRESS_404);
    const error = await readApiResponse(res, '/jobs/x/workspace').catch((e) => e);

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect((error as ApiRequestError).status).toBe(404);
    expect((error as ApiRequestError).endpoint).toBe('/jobs/x/workspace');
  });

  it('explains an HTML body as a possibly undeployed route', async () => {
    const error = (await readApiResponse(htmlResponse(EXPRESS_404), '/jobs/x/workspace').catch(
      (e) => e,
    )) as ApiRequestError;

    expect(error.message).toContain('HTML page instead of JSON');
    expect(error.message).toContain('not deployed');
    expect(error.message).not.toMatch(/Unexpected token/);
  });

  it('handles a JSON body served with no content type', async () => {
    const res = new Response(JSON.stringify({ success: true, data: 1 }), { status: 200 });
    // No content-type header at all -> must not be blindly trusted.
    await expect(readApiResponse(res, '/x')).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('handles a body that claims JSON but is not parseable', async () => {
    const res = new Response('not json at all', {
      status: 200,
      headers: { 'content-type': 'application/json' },
    });
    const error = (await readApiResponse(res, '/x').catch((e) => e)) as ApiRequestError;

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.message).toContain('could not be parsed');
  });

  it('handles an empty body', async () => {
    const res = new Response('', { status: 502, headers: { 'content-type': 'text/html' } });
    const error = (await readApiResponse(res, '/x').catch((e) => e)) as ApiRequestError;

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(502);
  });

  it('treats 204 as a success without a body', async () => {
    const res = new Response(null, { status: 204 });
    await expect(readApiResponse(res, '/x')).resolves.toEqual({ success: true });
  });

  it('reports a bodiless failure rather than pretending it succeeded', async () => {
    const res = new Response(null, { status: 500 });
    await expect(readApiResponse(res, '/x')).rejects.toBeInstanceOf(ApiRequestError);
  });

  it('tolerates plain JSON that is not our envelope on a success status', async () => {
    const res = jsonResponse([{ id: 1 }]);
    await expect(readApiResponse(res, '/x')).resolves.toEqual({
      success: true,
      data: [{ id: 1 }],
    });
  });

  it('throws a descriptive error for plain JSON on a failure status', async () => {
    const res = jsonResponse({ message: 'nope' }, 500);
    const error = (await readApiResponse(res, '/x').catch((e) => e)) as ApiRequestError;

    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error.status).toBe(500);
  });

  it('keeps a body snippet for diagnostics without dumping the whole page', async () => {
    const long = `<!DOCTYPE html><body>${'x'.repeat(5000)}</body>`;
    const error = (await readApiResponse(htmlResponse(long), '/x').catch((e) => e)) as ApiRequestError;

    expect(error.bodySnippet).not.toBeNull();
    expect((error.bodySnippet ?? '').length).toBeLessThanOrEqual(201);
  });
});

describe('toReadableError', () => {
  it('passes through ApiRequestError messages', () => {
    const err = new ApiRequestError('boom', { status: 500, endpoint: '/x' });
    expect(toReadableError(err, 'fallback')).toBe('boom');
  });

  it('translates an abort into a timeout message', () => {
    const abort = new Error('aborted');
    abort.name = 'AbortError';
    expect(toReadableError(abort, 'fallback')).toMatch(/timed out/i);
  });

  it('falls back for non-errors', () => {
    expect(toReadableError(undefined, 'fallback')).toBe('fallback');
    expect(toReadableError('a string', 'fallback')).toBe('fallback');
  });

  it('keeps a normal Error message', () => {
    expect(toReadableError(new Error('real problem'), 'fallback')).toBe('real problem');
  });
});