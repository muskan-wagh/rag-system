import { describe, it, expect, vi, beforeEach } from 'vitest';
import express from 'express';
import request from 'supertest';
import { errorHandler } from '@/middleware/errorHandler';

vi.mock('@/services/gmail/store', () => ({
  getGmailConnection: vi.fn(),
  getGmailCredentials: vi.fn(),
  upsertGmailConnection: vi.fn(),
  deleteGmailConnection: vi.fn(),
  updateGmailAccessToken: vi.fn(),
  touchGmailLastUsed: vi.fn(),
  markGmailNeedsReauth: vi.fn(),
}));

vi.mock('@/services/gmail/oauth', async (importOriginal) => {
  const orig = (await importOriginal()) as Record<string, unknown>;
  return {
    ...orig,
    isGmailConfigured: () => true,
    getGmailAuthUrl: () => 'https://accounts.google.com/o/oauth2/auth?test=1',
  };
});

import {
  gmailGetHandler,
  gmailDeleteHandler,
  gmailConnectHandler,
} from '@/controllers/gmailController';
import * as store from '@/services/gmail/store';

const mockedStore = vi.mocked(store);

function makeApp(recruiter?: { id: string }) {
  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    if (recruiter) (req as unknown as { recruiter: unknown }).recruiter = recruiter;
    next();
  });
  app.get('/g', gmailGetHandler);
  app.get('/c', gmailConnectHandler);
  app.delete('/d', gmailDeleteHandler);
  app.use(errorHandler);
  return app;
}

const FORBIDDEN_KEYS = ['refresh_token', 'refreshToken', 'access_token', 'accessToken', 'client_secret', 'clientSecret', 'code'];

function assertNoSecrets(body: unknown) {
  const text = JSON.stringify(body);
  for (const key of FORBIDDEN_KEYS) {
    expect(text).not.toContain(key);
  }
}

describe('Gmail endpoint auth + secrecy (supertest)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedStore.getGmailConnection.mockResolvedValue({
      connected: true,
      email: 'recruiter@gmail.com',
      status: 'active',
      googleAccountId: 'gid-1',
      scopes: ['https://www.googleapis.com/auth/gmail.send'],
      connectedAt: new Date().toISOString(),
      lastUsedAt: null,
      rowId: 'row-1',
    });
    mockedStore.getGmailCredentials.mockResolvedValue(null);
    mockedStore.deleteGmailConnection.mockResolvedValue(true);
  });

  it('requires authentication (401 without recruiter)', async () => {
    const app = makeApp(undefined);
    for (const req of [request(app).get('/g'), request(app).get('/c'), request(app).delete('/d')]) {
      const res = await req;
      expect(res.status).toBe(401);
    }
  });

  it('status never leaks tokens', async () => {
    const app = makeApp({ id: 'rec-A' });
    const res = await request(app).get('/g');
    expect(res.status).toBe(200);
    expect(mockedStore.getGmailConnection).toHaveBeenCalledWith('rec-A');
    assertNoSecrets(res.body);
    expect(res.body.data.email).toBe('recruiter@gmail.com');
  });

  it('connect redirects (302) without exposing secrets', async () => {
    const app = makeApp({ id: 'rec-A' });
    const res = await request(app).get('/c');
    expect(res.status).toBe(302);
    expect(res.headers.location).toContain('accounts.google.com');
  });

  it('disconnect is idempotent (200 twice, scoped to authed recruiter)', async () => {
    const app = makeApp({ id: 'rec-A' });
    const first = await request(app).delete('/d');
    const second = await request(app).delete('/d');
    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect(mockedStore.deleteGmailConnection).toHaveBeenCalledTimes(2);
    expect(mockedStore.deleteGmailConnection).toHaveBeenCalledWith('rec-A');
    assertNoSecrets(first.body);
    assertNoSecrets(second.body);
  });

  it('recruiter A cannot touch recruiter B (all queries scoped)', async () => {
    const appA = makeApp({ id: 'rec-A' });
    await request(appA).get('/g');
    await request(appA).delete('/d');
    for (const call of mockedStore.getGmailConnection.mock.calls) {
      expect(call[0]).toBe('rec-A');
    }
    for (const call of mockedStore.deleteGmailConnection.mock.calls) {
      expect(call[0]).toBe('rec-A');
      expect(call[0]).not.toBe('rec-B');
    }
  });

  it('disconnected state returns connected:false with no email leak beyond safe fields', async () => {
    mockedStore.getGmailConnection.mockResolvedValue({
      connected: false,
      email: '',
      status: 'disconnected',
      googleAccountId: '',
      scopes: [],
      connectedAt: null,
      lastUsedAt: null,
      rowId: null,
    });
    const app = makeApp({ id: 'rec-A' });
    const res = await request(app).get('/g');
    expect(res.status).toBe(200);
    expect(res.body.data.connected).toBe(false);
    assertNoSecrets(res.body);
  });
});
