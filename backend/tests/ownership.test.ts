import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';

// Mock the Supabase client so ownership checks are exercised without infra.
// A single fluent query object is shared so `.eq().eq().maybeSingle()` and
// `.eq().in()` both resolve against the same controlled result.
type QueryResult = { data: unknown; error: { message: string } | null };

const queryResult: { current: QueryResult } = {
  current: { data: null, error: null },
};

const eqCalls: Array<[string, unknown]> = [];
const inCalls: unknown[] = [];

const candidatesQuery = {
  select: vi.fn(() => candidatesQuery),
  eq: vi.fn((column: string, value: unknown) => {
    eqCalls.push([column, value]);
    return candidatesQuery;
  }),
  in: vi.fn((column: string, values: unknown) => {
    inCalls.push([column, values]);
    return candidatesQuery;
  }),
  maybeSingle: vi.fn(async () => queryResult.current),
  single: vi.fn(async () => queryResult.current),
  // Supabase query builders are thenable; several call sites await the builder
  // directly instead of awaiting a terminal method.
  then: (resolve: (v: QueryResult) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(queryResult.current).then(resolve, reject),
};

vi.mock('@/services/supabase/client', () => ({
  getSupabaseClient: () => ({
    from: (table: string) => {
      if (table === 'candidates') return candidatesQuery;
      return { select: vi.fn(() => ({ eq: vi.fn(() => ({ maybeSingle: vi.fn() })) })) };
    },
  }),
}));

import { requireOwnedCandidateMiddleware, filterOwnedCandidateIds } from '@/middleware/ownership';
import { verifyClerkToken } from '@/middleware/auth';
import { AppError, errorHandler } from '@/middleware/errorHandler';

function makeApp(recruiter?: { id: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (recruiter) (req as unknown as { recruiter: unknown }).recruiter = recruiter;
    next();
  });
  app.use('/:id', requireOwnedCandidateMiddleware);
  app.get('/:id', (_req, res) => {
    res.status(200).json({ success: true });
  });
  app.use(errorHandler);
  return app;
}

/** Build an unsigned three-part JWT with an arbitrary `sub`. */
function forgedJwt(sub: string): string {
  const enc = (o: unknown) =>
    Buffer.from(JSON.stringify(o)).toString('base64').replace(/=/g, '').replace(/\+/g, '-').replace(/\//g, '_');
  return `${enc({ alg: 'RS256', typ: 'JWT' })}.${enc({ sub, exp: 9999999999 })}.forged-signature`;
}

describe('Recruiter auth: signature verification', () => {
  beforeEach(() => vi.clearAllMocks());

  it('rejects an unsigned/forged JWT instead of trusting its `sub`', async () => {
    // The regression this guards: authMiddleware base64-decoded the payload and
    // accepted any three-part token, so anyone could mint a recruiter identity.
    const result = await verifyClerkToken(forgedJwt('user_attacker'));
    expect('error' in result).toBe(true);
    expect(result).not.toHaveProperty('clerkId', 'user_attacker');
  });

  it('rejects structurally malformed tokens', async () => {
    expect(await verifyClerkToken('not-a-jwt')).toHaveProperty('error');
    expect(await verifyClerkToken('')).toHaveProperty('error');
    expect(await verifyClerkToken('a.b')).toHaveProperty('error');
  });
});

describe('Candidate ownership boundary', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    inCalls.length = 0;
    queryResult.current = { data: null, error: null };
  });

  it('allows a recruiter to reach their own candidate', async () => {
    queryResult.current = { data: { id: 'cand-1' }, error: null };
    const res = await request(makeApp({ id: 'rec-1' })).get('/cand-1');
    expect(res.status).toBe(200);
    // Ownership is enforced in the query, not by post-filtering.
    expect(eqCalls).toContainEqual(['id', 'cand-1']);
    expect(eqCalls).toContainEqual(['recruiter_id', 'rec-1']);
  });

  it('returns 404 (not 403) for another recruiter\'s candidate — no existence leak', async () => {
    queryResult.current = { data: null, error: null };
    const res = await request(makeApp({ id: 'rec-1' })).get('/someone-elses-candidate');
    expect(res.status).toBe(404);
    expect(JSON.stringify(res.body)).not.toContain('rec-1');
  });

  it('rejects an unauthenticated request before touching the candidate', async () => {
    queryResult.current = { data: { id: 'cand-1' }, error: null };
    const res = await request(makeApp()).get('/cand-1');
    expect(res.status).toBe(401);
    // No ownership query should have been issued at all.
    expect(eqCalls).toHaveLength(0);
  });

  it('surfaces a 500 when the ownership query itself fails', async () => {
    queryResult.current = { data: null, error: { message: 'db down' } };
    const res = await request(makeApp({ id: 'rec-1' })).get('/cand-1');
    expect(res.status).toBe(500);
  });
});

describe('filterOwnedCandidateIds', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    eqCalls.length = 0;
    inCalls.length = 0;
    queryResult.current = { data: null, error: null };
  });

  it('returns only the subset the recruiter owns', async () => {
    // The recruiter owns 'a' and 'b' but not 'c'.
    queryResult.current = { data: [{ id: 'a' }, { id: 'b' }], error: null };
    const owned = await filterOwnedCandidateIds('rec-1', ['a', 'b', 'c']);
    expect(owned.sort()).toEqual(['a', 'b']);
    expect(inCalls).toContainEqual(['id', ['a', 'b', 'c']]);
  });

  it('de-duplicates ids and short-circuits on an empty list', async () => {
    await filterOwnedCandidateIds('rec-1', ['a', 'a', 'b', 'a']);
    // Duplicate ids are collapsed so the IN clause stays minimal.
    expect(inCalls).toContainEqual(['id', ['a', 'b']]);
    // Empty input must not hit the database at all.
    expect(await filterOwnedCandidateIds('rec-1', [])).toEqual([]);
  });

  it('throws rather than failing open on a query error', async () => {
    queryResult.current = { data: null, error: { message: 'nope' } };
    await expect(filterOwnedCandidateIds('rec-1', ['a'])).rejects.toBeInstanceOf(AppError);
  });
});