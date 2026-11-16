import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

// The app reads these through ConfigService when it starts. Values already in the environment win
// over .env, so these protect your real database and files from the tests.
process.env.NODE_ENV = 'test';
process.env.DB_NAME = process.env.DB_NAME_E2E ?? 'nestlearn_test';
process.env.GEMINI_API_KEY = 'test-key-never-used'; // AiService is replaced by a fake, but it still demands a key
process.env.EMBEDDING_BACKFILL = 'false'; // the background job must not touch test data
process.env.DEV_AUTO_LOGIN = 'false';
process.env.UPLOAD_DIR ??= mkdtempSync(join(tmpdir(), 'nestjs-learn-e2e-'));
