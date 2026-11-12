import {
	formatAge,
	formatEv,
	formatFt,
	formatKickoff,
	formatOdds,
	formatPairing,
	formatPercent,
	formatPp,
	formatScore,
	formatUnits,
	formatYearMonth
} from './format';

const NB = ' ';
const M = '−';

describe('format (DESIGN §8)', () => {
	it('odds: 2 tizedes, vessző', () => {
		expect(formatOdds(1.8)).toBe('1,80');
		expect(formatOdds(3.1)).toBe('3,10');
		expect(formatOdds(12.345)).toBe('12,35');
		expect(formatOdds(1001)).toBe(`1${NB}001,00`);
	});

	it('valószínűség: egész %', () => {
		expect(formatPercent(0.613)).toBe('61%');
		expect(formatPercent(1)).toBe('100%');
	});

	it('pp: előjeles egész', () => {
		expect(formatPp(7)).toBe(`+7${NB}pp`);
		expect(formatPp(-3.4)).toBe(`${M}3${NB}pp`);
		expect(formatPp(0.2)).toBe(`0${NB}pp`);
	});

	it('EV: előjeles egész %, valódi mínuszjel', () => {
		expect(formatEv(0.1)).toBe('+10%');
		expect(formatEv(-0.03)).toBe(`${M}3%`);
		expect(formatEv(0.004)).toBe('0%');
		expect(formatEv(-0.004)).toBe('0%');
	});

	it('Ft: egész, ezres NBSP (4 jegyűnél is)', () => {
		expect(formatFt(3096)).toBe(`3${NB}096${NB}Ft`);
		expect(formatFt(1234567.4)).toBe(`1${NB}234${NB}567${NB}Ft`);
		expect(formatFt(500)).toBe(`500${NB}Ft`);
		expect(formatFt(-2000)).toBe(`${M}2${NB}000${NB}Ft`);
	});

	it('egység: 1 tizedes, előjellel', () => {
		expect(formatUnits(0.9)).toBe(`+0,9${NB}egység`);
		expect(formatUnits(-1.25)).toBe(`${M}1,3${NB}egység`);
		expect(formatUnits(0)).toBe(`0,0${NB}egység`);
	});

	describe('kezdési időpont (Europe/Budapest)', () => {
		// 2026-11-12 csütörtök, 10:00 budapesti idő (UTC+1)
		const now = new Date('2026-11-12T09:00:00Z');
		it('ma', () => expect(formatKickoff(new Date('2026-11-12T14:00:00Z'), now)).toBe('ma 15:00'));
		it('holnap', () => expect(formatKickoff(new Date('2026-11-13T17:30:00Z'), now)).toBe('holnap 18:30'));
		it('egyébként nap-rövidítés', () => {
			expect(formatKickoff(new Date('2026-11-15T13:00:00Z'), now)).toBe('V 14:00');
			expect(formatKickoff(new Date('2026-11-14T19:00:00Z'), now)).toBe('Szo 20:00');
			expect(formatKickoff(new Date('2026-11-18T19:00:00Z'), now)).toBe('Sze 20:00');
		});
		it('éjfél után a budapesti nap számít', () => {
			// 23:30 UTC = másnap 00:30 Budapesten
			expect(formatKickoff(new Date('2026-11-12T23:30:00Z'), now)).toBe('holnap 00:30');
		});
	});

	it('dátum: ÉÉÉÉ.HH', () => {
		expect(formatYearMonth(new Date('2025-04-20T18:00:00Z'))).toBe('2025.04');
	});

	it('eredmény és párosítás nagykötőjellel', () => {
		expect(formatScore(2, 0)).toBe('2–0');
		expect(formatPairing('Arsenal', 'Chelsea')).toBe('Arsenal – Chelsea');
	});

	it('adat kora: órában 48 óráig, utána napban', () => {
		const h = 3_600_000;
		expect(formatAge(30 * h + 59_000)).toBe(`30${NB}órás`);
		expect(formatAge(47 * h)).toBe(`47${NB}órás`);
		expect(formatAge(72 * h)).toBe(`3${NB}napos`);
	});
});
