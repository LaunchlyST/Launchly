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

  it('shows one Editor Tools box with a divider and no accordion sections', () => {
    seedConnected();
    const { container } = render(<CreatorStorePage />);
    expect(screen.getByText('Editor Tools')).toBeTruthy();
    expect(container.querySelectorAll('.cs-editor-tools').length).toBe(1);
    expect(container.querySelector('.cs-divider')).toBeTruthy();
    expect(screen.queryByText('Page')).toBeNull();
    expect(screen.queryByText('Design')).toBeNull();
    expect(screen.queryByText('Content')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Products' })).toBeNull();
    expect(screen.getByRole('status')).toBeTruthy(); // Saved indicator
    expect(screen.getByLabelText('Live preview of your public page')).toBeTruthy();
    expect(screen.getByRole('button', { name: /Publish/ })).toBeTruthy();
  });

  it('stays in the builder after a refresh once connected', () => {
    seedConnected();
    const first = render(<CreatorStorePage />);
    expect(screen.getByText('Editor Tools')).toBeTruthy();
    first.unmount();
    cleanup();
    render(<CreatorStorePage />);
    expect(screen.getByText('Editor Tools')).toBeTruthy();
    expect(screen.queryByLabelText('TikTok username')).toBeNull();
  });

  it('edits a product by clicking it in the phone preview', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByText('Viral Preset Pack'));
    expect(screen.getByLabelText('Product image URL')).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Test Ebook' } });
    expect(screen.getAllByText('Test Ebook').length).toBeGreaterThan(0);
  });

  it('updates the same Editor Tools box when clicking different preview items', () => {
    seedConnected();
    const { container } = render(<CreatorStorePage />);
    fireEvent.click(screen.getByText('Viral Preset Pack'));
    expect(screen.getByLabelText('Product image URL')).toBeTruthy();
    fireEvent.click(screen.getByText('My latest video'));
    expect(screen.queryByLabelText('Product image URL')).toBeNull();
    expect(screen.getByLabelText('Label')).toBeTruthy();
    // Still exactly one box on the left.
    expect(container.querySelectorAll('.cs-editor-tools').length).toBe(1);
    expect(screen.getByText('Editor Tools')).toBeTruthy();
  });

  it('clears back to the default Editor Tools box when clicking empty preview space', () => {
    seedConnected();
    const { container } = render(<CreatorStorePage />);
    fireEvent.click(screen.getByText('Viral Preset Pack'));
    expect(screen.getByLabelText('Product image URL')).toBeTruthy();
    const content = container.querySelector('.pv-content');
    expect(content).toBeTruthy();
    fireEvent.click(content!);
    expect(screen.queryByLabelText('Product image URL')).toBeNull();
    expect(screen.getByText('Editor Tools')).toBeTruthy();
    expect(container.querySelectorAll('.cs-editor-tools').length).toBe(1);
  });

  it('undoes a display name change', () => {
    seedConnected();
    render(<CreatorStorePage />);
    // Profile fields appear in Editor Tools after clicking the profile in the preview.
    fireEvent.click(screen.getByText('Your Studio'));
    const input = screen.getByLabelText('Display name') as HTMLInputElement;
    const before = input.value;
    fireEvent.change(input, { target: { value: 'Changed Name' } });
    expect(input.value).toBe('Changed Name');
    fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
    expect((screen.getByLabelText('Display name') as HTMLInputElement).value).toBe(before);
  });

  it('adds a TikTok video from the preview block editor', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByText(/No videos yet/));
    fireEvent.click(screen.getByRole('button', { name: 'Add TikTok' }));
    expect(screen.getByLabelText('TikTok URL')).toBeTruthy();
  });

  it('scales the phone preview uniformly by dragging the edge handle', () => {
    seedConnected();
    const { container } = render(<CreatorStorePage />);
    const phone = container.querySelector('.pv-phone') as HTMLElement;
    const handleEl = container.querySelector('.pv-resize') as HTMLElement;
    expect(phone).toBeTruthy();
    expect(handleEl).toBeTruthy();
    expect(phone.style.width).toBe('');
    fireEvent.pointerDown(handleEl, { button: 0, clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(handleEl, { clientX: 150, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(handleEl, { pointerId: 1 });
    // Width follows the horizontal drag; height scales proportionally (292:620).
    expect(phone.style.width).toBe('342px');
    expect(phone.style.height).toBe(`${Math.round(342 * (620 / 292))}px`);
  });
});
