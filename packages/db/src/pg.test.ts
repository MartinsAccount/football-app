import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { readDatabaseUrl } from './pg';

describe('readDatabaseUrl', () => {
	const saved = process.env.DATABASE_URL;
	afterEach(() => {
		if (saved === undefined) delete process.env.DATABASE_URL;
		else process.env.DATABASE_URL = saved;
	});

	it('a környezeti változót részesíti előnyben', () => {
		process.env.DATABASE_URL = 'postgresql://env';
		expect(readDatabaseUrl('/nincs/ilyen/.env')).toBe('postgresql://env');
	});

	it('a .env fájlból olvas (CRLF is)', () => {
		delete process.env.DATABASE_URL;
		const file = join(mkdtempSync(join(tmpdir(), 'pgenv-')), '.env');
		writeFileSync(file, 'FOO=1\r\nDATABASE_URL=postgresql://file \r\n');
		expect(readDatabaseUrl(file)).toBe('postgresql://file');
	});

	it('hibát dob, ha sehol nincs', () => {
		delete process.env.DATABASE_URL;
		expect(() => readDatabaseUrl('/nincs/ilyen/.env')).toThrow(/DATABASE_URL/);
	});
});
