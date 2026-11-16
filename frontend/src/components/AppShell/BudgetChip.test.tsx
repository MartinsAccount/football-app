/** @vitest-environment jsdom */
import { act, fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import type { BudgetResponse } from '@football/contract';
import BudgetChip from './BudgetChip';

const BUDGET: BudgetResponse = {
	day: '2026-11-12',
	used: 12,
	limit: 100,
	reserve: 3,
	syncedRemaining: 88,
	remaining: 85,
	jobs: [{ job: 'odds_late', live: 12, mock: 4 }],
	status: { checkedAt: '2026-11-12T07:30:00Z', remainingAtCheck: 95 },
	cron: { runs: 2, calls: 12, lastAt: '2026-11-12T09:00:00Z', lastStatus: 'ok' }
};

const now = () => new Date('2026-11-12T10:00:00Z');
const flush = () => act(() => Promise.resolve());

describe('BudgetChip', () => {
	it('a pill a /api/budget számát mutatja, kattintásra lenyílik a bontás', async () => {
		render(<BudgetChip fixture localCalls={0} load={() => Promise.resolve(BUDGET)} now={now} />);
		await flush();
		const btn = screen.getByRole('button');
		expect(btn.textContent).toBe('Mentett adat · 12/100 hívás');
		expect(btn.getAttribute('aria-expanded')).toBe('false');
		expect(screen.getByRole('region', { hidden: true }).hidden).toBe(true);
		fireEvent.click(btn);
		await flush();
		expect(btn.getAttribute('aria-expanded')).toBe('true');
		const panel = screen.getByRole('region');
		expect(panel.textContent).toContain('Késői odds');
		expect(panel.textContent).toContain('+ 4 mock');
		expect(panel.textContent).toContain('Egyezik a /status-szal (ma 08:30).');
		expect(panel.textContent).toContain('2 ütemező-futás, 12 hívás · utolsó ma 10:00');
		fireEvent.keyDown(btn, { key: 'Escape' });
		expect(btn.getAttribute('aria-expanded')).toBe('false');
	});

	it('hibánál a böngésző saját számlálója marad, a panel elmondja az okát', async () => {
		render(<BudgetChip fixture={false} localCalls={7} load={() => Promise.reject(new Error('down'))} now={now} />);
		await flush();
		const btn = screen.getByRole('button');
		expect(btn.textContent).toBe('Élő adat · 7/100 hívás');
		fireEvent.click(btn);
		await flush();
		expect(screen.getByRole('region').textContent).toContain('nem érhető el');
	});
});
