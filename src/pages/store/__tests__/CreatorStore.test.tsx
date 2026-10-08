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

  it('opens the builder directly when a connected store is saved', () => {
    seedConnected();
    render(<CreatorStorePage />);
    expect(screen.getByText('Page')).toBeTruthy();
    expect(screen.getByText('Design')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Products' })).toBeTruthy();
    expect(screen.getByRole('status')).toBeTruthy(); // Saved indicator
    expect(screen.getByLabelText('Live preview of your public page')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Publish/ })).toBeTruthy();
  });

  it('stays in the builder after a refresh once connected', () => {
    seedConnected();
    const first = render(<CreatorStorePage />);
    expect(screen.getByText('Design')).toBeTruthy();
    first.unmount();
    cleanup();
    render(<CreatorStorePage />);
    expect(screen.getByText('Design')).toBeTruthy();
    expect(screen.queryByLabelText('TikTok username')).toBeNull();
  });

  it('switch account returns to setup without redoing anything else', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByRole('button', { name: /Switch account/ }));
    expect(screen.getByLabelText('TikTok username')).toBeTruthy();
  });

  it('adds a product from the content controls and edits it', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Product' }));
    expect(screen.getByLabelText('Product image URL')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Test Ebook' } });
    expect(screen.getAllByText('Test Ebook').length).toBeGreaterThan(0);
  });

  it('shows one focused box when clicking the preview, back returns to all controls', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByText('Viral Preset Pack'));
    expect(screen.getByLabelText('Product image URL')).toBeTruthy();
    expect(screen.queryByText('Design')).toBeNull();
    expect(screen.queryByText('Content')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: /All controls/ }));
    expect(screen.getByText('Design')).toBeTruthy();
    expect(screen.getByText('Content')).toBeTruthy();
  });

  it('keeps only one inline editor open at a time', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByRole('button', { name: 'Shop' }));
    expect(screen.getByLabelText('Block title')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Products' }));
    fireEvent.click(screen.getByRole('button', { name: /Viral Preset Pack/ }));
    expect(screen.getByLabelText('Product image URL')).toBeTruthy();
    expect(screen.queryByLabelText('Block title')).toBeNull();
  });

  it('opens the background editor when clicking empty preview space', () => {
    seedConnected();
    const { container } = render(<CreatorStorePage />);
    const content = container.querySelector('.pv-content');
    expect(content).toBeTruthy();
    fireEvent.click(content!);
    expect(screen.getByText('Glass cards')).toBeTruthy();
    expect(screen.queryByText('Design')).toBeNull();
  });

  it('undoes a display name change', () => {
    seedConnected();
    render(<CreatorStorePage />);
    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    const before = input.value;
    fireEvent.change(input, { target: { value: 'Changed Name' } });
    expect(input.value).toBe('Changed Name');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe(before);
  });

  it('adds a TikTok block from the content controls', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByRole('button', { name: 'TikTok' }));
    expect(screen.getByLabelText('TikTok URL')).toBeTruthy();
  });
});
