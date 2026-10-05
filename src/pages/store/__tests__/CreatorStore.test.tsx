import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreatorStorePage } from '../CreatorStorePage';
import { STORAGE_KEY, defaultPersisted } from '../store';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

function seedConnected() {
  const base = defaultPersisted();
  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify({
      ...base,
      setup: { ...base.setup, step: 6, username: 'testcreator', connected: true, code: 'LAUNCHLY-ABC123' },
    })
  );
}

describe('CreatorStorePage', () => {
  it('starts the setup flow at step 1 with the progress bar', () => {
    render(<CreatorStorePage />);
    expect(screen.getByRole('navigation', { name: /setup progress/i })).toBeTruthy();
    expect(screen.getByLabelText('TikTok username')).toBeTruthy();
    expect(screen.getByText('TikTok Username')).toBeTruthy();
    expect(screen.getByText('Creator Store')).toBeTruthy();
  });

  it('advances from step 1 to step 2 and shows a verification code', () => {
    render(<CreatorStorePage />);
    fireEvent.change(screen.getByLabelText('TikTok username'), { target: { value: 'testcreator' } });
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }));
    expect(screen.getByText(/verification code/i)).toBeTruthy();
    expect(screen.getByText(/LAUNCHLY-/)).toBeTruthy();
  });

  it('opens the designer directly when a connected store is saved', () => {
    seedConnected();
    render(<CreatorStorePage />);
    expect(screen.getByText('Page sections')).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy(); // Saved indicator
    expect(screen.getByLabelText('Live preview of your public page')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Publish/ })).toBeTruthy();
  });

  it('adds a product from the designer controls', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByRole('button', { name: /Product/ }));
    expect(screen.getByText('Edit product')).toBeTruthy();
  });
});
