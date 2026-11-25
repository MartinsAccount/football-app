// Web-login jelszó (I31): `npm run password -w @football/server`. Bekéri a jelszót, és kiírja a Vercel-env két értékét:
// `APP_PASSWORD_HASH` (PBKDF2-hash) és egy új, véletlen `SESSION_SECRET`. Semmit nem ír fájlba.
// A jelszó a terminálban látszik gépelés közben; ne futtasd megosztott képernyőn. Ne másold be chatbe.
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';
import { hashPassword } from '../src/session';

const rl = createInterface({ input: process.stdin, output: process.stdout });
const password = await rl.question('Új admin-jelszó (min. 8 karakter, ne szótári szó): ');
const again = await rl.question('Még egyszer: ');
rl.close();

if (password !== again) {
	console.error('A két jelszó nem egyezik – semmi sem készült.');
	process.exit(1);
}
if (password.length < 8) {
	console.error('Legalább 8 karakter legyen – semmi sem készült.');
	process.exit(1);
}

console.log(`\nAPP_PASSWORD_HASH (a Vercel env-be): ${await hashPassword(password)}`);
console.log(`SESSION_SECRET    (a Vercel env-be): ${randomBytes(32).toString('base64url')}`);
console.warn('\nMindkettőt Secret típusként vedd fel (Production + Preview), utána Redeploy.');
console.warn('A SESSION_SECRET cseréje minden bejelentkezett eszközt kiléptet.');
