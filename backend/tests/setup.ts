// Test env — dummy values so config validation passes without real infra.
// Real network/clients are never touched; Google/Supabase are mocked per-test.
process.env.NODE_ENV = process.env.NODE_ENV || 'test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';
process.env.SUPABASE_URL = process.env.SUPABASE_URL || 'http://localhost:54321';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';
process.env.QWEN_API_KEY = process.env.QWEN_API_KEY || 'test-qwen-key';
process.env.QDRANT_URL = process.env.QDRANT_URL || 'http://localhost:6333';
process.env.QDRANT_API_KEY = process.env.QDRANT_API_KEY || 'test-qdrant-key';
process.env.CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY || 'test-clerk-secret-key-for-hmac-state';
process.env.GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID || 'test-client-id.apps.googleusercontent.com';
process.env.GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET || 'test-client-secret';
process.env.GOOGLE_REDIRECT_URI =
  process.env.GOOGLE_REDIRECT_URI || 'http://localhost:5000/api/integrations/gmail/callback';
process.env.GMAIL_TOKEN_ENCRYPTION_KEY =
  process.env.GMAIL_TOKEN_ENCRYPTION_KEY ||
  '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.CLIENT_URL = process.env.CLIENT_URL || 'http://localhost:3000';
// Resend intentionally left empty so regression tests verify the safe path.
delete process.env.RESEND_API_KEY;
