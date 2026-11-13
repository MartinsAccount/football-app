/** @vitest-environment jsdom */
import { act, render, screen } from '@testing-library/react';
import React from 'react';
import OfflineIndicator from './OfflineIndicator';

const setOnline = (value: boolean) => Object.defineProperty(window.navigator, 'onLine', { configurable: true, get: () => value });

describe('OfflineIndicator', () => {
	it('online-ként rejtett, offline eseményre megjelenik, online-ra eltűnik', () => {
		setOnline(true);
		render(<OfflineIndicator />);
		expect(screen.queryByRole('status')).toBeNull();
		act(() => {
			setOnline(false);
			window.dispatchEvent(new Event('offline'));
		});
		expect(screen.getByRole('status').textContent).toContain('Nincs kapcsolat');
		act(() => {
			setOnline(true);
			window.dispatchEvent(new Event('online'));
		});
		expect(screen.queryByRole('status')).toBeNull();
	});
});
