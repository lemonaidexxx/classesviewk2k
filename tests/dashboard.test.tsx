// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom/vitest';
import Dashboard from '../src/components/dashboard';
import { previewSnapshot } from '../src/lib/fixtures';
vi.mock('../src/components/footer', () => ({ default: () => <footer>Footer</footer> }));
beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
it('keeps last successful data on refresh failure and recovers', async () => {
  const data = previewSnapshot();
  vi.mocked(fetch)
    .mockResolvedValueOnce(new Response(JSON.stringify(data)))
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ error: 'Temporary outage', code: 'temporary' }), {
        status: 503,
      }),
    )
    .mockResolvedValueOnce(
      new Response(JSON.stringify({ ...data, fetchedAt: '2026-09-17T02:35:00Z' })),
    );
  render(<Dashboard />);
  await screen.findByText('17', { selector: '.metric-value' });
  fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }));
  await screen.findByText('Refresh failed — showing last good data');
  expect(screen.getByText('17', { selector: '.metric-value' })).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: 'Refresh data' }));
  await waitFor(() =>
    expect(screen.queryByText('Refresh failed — showing last good data')).not.toBeInTheDocument(),
  );
  expect(fetch).toHaveBeenCalledTimes(3);
});
it('shows configuration errors without fake totals', async () => {
  vi.mocked(fetch).mockResolvedValueOnce(
    new Response(
      JSON.stringify({
        error: 'Google Sheets connection is not configured.',
        code: 'configuration',
      }),
      { status: 503 },
    ),
  );
  render(<Dashboard />);
  await screen.findByText('Connection setup required');
  expect(screen.queryByRole('table')).not.toBeInTheDocument();
  expect(screen.queryByText('0', { selector: '.metric-value' })).not.toBeInTheDocument();
});
