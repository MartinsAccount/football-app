// Új Bearer token a mobilklienshez (ADR-0005): `npm run token -w @football/server`. Semmit nem ír fájlba.
import { randomBytes } from 'node:crypto';
import { hashToken } from '../src/auth';

const token = randomBytes(32).toString('base64url');
const hash = await hashToken(token);

console.log(`TOKEN (a telefonra, expo-secure-store):  ${token}`);
console.log(`APP_API_TOKEN_HASH (a hosting env-be):   ${hash}`);
console.warn('\nFigyelem: a tokent csak a telefonra vidd, a hash-t a hosting env-be (APP_API_TOKEN_HASH).');
console.warn('Egyiket se commitold, és ne írd naplóba. A régi token az env-hash cseréjével azonnal érvénytelen.');
