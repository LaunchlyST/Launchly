import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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

  describe('locked TikTok profile', () => {
    it('never opens an editor panel when the profile in the phone is clicked', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const profile = container.querySelector('.pv-profile') as HTMLElement;
      expect(profile).toBeTruthy();
      expect(profile.dataset.locked).toBe('true');

      // Click the avatar, the handle and the bio — no panel may appear.
      const targets = [
        container.querySelector('.pv-avatar'),
        container.querySelector('.pv-handle'),
        container.querySelector('.pv-bio'),
        profile,
      ];
      for (const el of targets) {
        fireEvent.click(el as Element);
        expect(screen.queryByText('Synced with TikTok')).toBeNull();
        expect(screen.queryByRole('button', { name: /Sync now/i })).toBeNull();
        expect(container.querySelector('.pv-profile.is-selected')).toBeNull();
        expect(container.querySelector('.pv-profile.is-hover')).toBeNull();
      }
      // The overview stays on screen and the profile is still rendered.
      expect(screen.getByText('Editor Tools')).toBeTruthy();
      expect(container.querySelectorAll('.pv-profile')).toHaveLength(1);
      expect(container.querySelector('.pv-profile .pv-name')?.textContent).toBeTruthy();
      expect(container.querySelector('.pv-profile .pv-bio')?.textContent).toBeTruthy();
    });

    it('keeps clicking other sections working', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      fireEvent.click(screen.getByText('Viral Preset Pack'));
      expect(screen.getByLabelText('Product image URL')).toBeTruthy();
      // A click on the locked profile must not clear the open editor either.
      fireEvent.click(container.querySelector('.pv-profile') as Element);
      expect(screen.getByLabelText('Product image URL')).toBeTruthy();
    });

    it('offers the synced read-only profile panel without editable fields', () => {
      seedConnected();
      render(<CreatorStorePage />);
      // Reachable only from the Editor Tools section list, never from the phone.
      fireEvent.click(screen.getByTitle(/Profile · locked at the top/));
      expect(screen.getByText('Synced with TikTok')).toBeTruthy();
      expect(screen.queryByLabelText('Display name')).toBeNull();
      expect(screen.queryByLabelText('Profile photo URL')).toBeNull();
      expect(screen.getByRole('button', { name: /Sync now/i })).toBeTruthy();
    });
  });

  it('adds a TikTok video from the preview block editor', () => {
    seedConnected();
    render(<CreatorStorePage />);
    fireEvent.click(screen.getByText(/No videos yet/));
    fireEvent.click(screen.getByRole('button', { name: 'Add TikTok' }));
    expect(screen.getByLabelText('TikTok URL')).toBeTruthy();
  });

  it('resizes the phone preview width only by dragging the edge handle', () => {
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
    // Width follows the horizontal drag; height never changes.
    expect(phone.style.width).toBe('342px');
    expect(phone.style.height).toBe('');
    // The divider sits between the editor and the phone.
    expect(container.querySelector('.cs-divider')).toBeTruthy();
    // Dragging further stops inside the centred right column (360 max)
    // so the phone never pushes into the divider or overflows.
    fireEvent.pointerDown(handleEl, { button: 0, clientX: 150, clientY: 100, pointerId: 2 });
    fireEvent.pointerMove(handleEl, { clientX: 2000, clientY: 100, pointerId: 2 });
    fireEvent.pointerUp(handleEl, { pointerId: 2 });
    expect(phone.style.width).toBe('360px');
  });

  describe('preview', () => {
    function openPreview() {
      seedConnected();
      const utils = render(<CreatorStorePage />);
      fireEvent.click(screen.getByRole('button', { name: /^Preview$/ }));
      return utils;
    }

    it('replaces the editor with a full-screen preview showing exactly one phone', () => {
      const { container } = openPreview();
      expect(container.querySelectorAll('.cs-pv')).toHaveLength(1);
      // Exactly one device, and it is the only phone in the whole preview.
      expect(container.querySelectorAll('.pv-phone')).toHaveLength(1);
      // No editor chrome, no drag affordances, no dark scrim or blur layer.
      expect(screen.queryByText('Editor Tools')).toBeNull();
      expect(container.querySelector('.cs-modal')).toBeNull();
      expect(container.querySelector('.pv-resize')).toBeNull();
      expect(container.querySelector('.pv-grip')).toBeNull();
      expect(container.querySelector('.cs-divider')).toBeNull();
      expect(container.querySelector('.cs-editor-tools')).toBeNull();
      expect(container.querySelector('.pv-dropzone')).toBeNull();
    });

    it('offers Back to Editor plus Desktop and Mobile preview options', () => {
      openPreview();
      expect(screen.getByRole('button', { name: /Back to Editor/ })).toBeTruthy();
      const group = screen.getByRole('group', { name: /Preview size/i });
      const desktop = within(group).getByRole('button', { name: /Desktop/ });
      const mobile = within(group).getByRole('button', { name: /Mobile/ });
      expect(desktop).toBeTruthy();
      expect(mobile).toBeTruthy();
      // Mobile (a real phone) is the default view.
      expect(mobile.getAttribute('aria-pressed')).toBe('true');
      expect(desktop.getAttribute('aria-pressed')).toBe('false');
    });

    it('switches between a single phone and a frameless desktop page', () => {
      const { container } = openPreview();
      const group = screen.getByRole('group', { name: /Preview size/i });

      fireEvent.click(within(group).getByRole('button', { name: /Desktop/ }));
      // Desktop drops the device frame entirely — still only one page, no phone.
      expect(container.querySelectorAll('.pv-phone')).toHaveLength(0);
      expect(container.querySelectorAll('.pv-page')).toHaveLength(1);
      expect(container.querySelector('.cs-pv__browser')).toBeTruthy();

      fireEvent.click(within(group).getByRole('button', { name: /Mobile/ }));
      expect(container.querySelectorAll('.pv-phone')).toHaveLength(1);
      expect(container.querySelectorAll('.pv-page')).toHaveLength(0);
      expect(container.querySelector('.cs-pv__browser')).toBeNull();
    });

    it('returns to the untouched editor from the preview', () => {
      const { container } = openPreview();
      fireEvent.click(screen.getByRole('button', { name: /Back to Editor/ }));
      expect(container.querySelector('.cs-pv')).toBeNull();
      expect(screen.getByText('Editor Tools')).toBeTruthy();
      expect(container.querySelectorAll('.pv-phone')).toHaveLength(1);
      // Entering and leaving preview must not alter the saved design.
      expect(screen.getByText('Viral Preset Pack')).toBeTruthy();
      expect(screen.getByText('Your Studio')).toBeTruthy();
    });

    it('leaves the preview on Escape', () => {
      const { container } = openPreview();
      fireEvent.keyDown(window, { key: 'Escape' });
      expect(container.querySelector('.cs-pv')).toBeNull();
      expect(screen.getByText('Editor Tools')).toBeTruthy();
    });
  });

  describe('palette drag-and-drop', () => {
    /** jsdom has no layout, so give the phone content a real box. */
    function stubContentBox(content: HTMLElement, top = 100, height = 600, left = 100, width = 260) {
      content.getBoundingClientRect = () =>
        ({ top, left, width, height, right: left + width, bottom: top + height, x: left, y: top, toJSON: () => ({}) }) as DOMRect;
    }

    function blockBox(top: number, height: number) {
      return () =>
        ({ top, left: 100, width: 260, height, right: 360, bottom: top + height, x: 100, y: top, toJSON: () => ({}) }) as DOMRect;
    }

    /**
     * Stubs rects at the prototype level and derives each block's slot from its
     * *current* DOM order, so the boxes survive the re-render that happens
     * mid-drag (per-element stubs would be thrown away with the old nodes).
     */
    /** Synthesises the phone's layout, including the reflow the drop indicator
        causes: it is a real flex child of .pv-content, so every block below it
        is pushed down by its height. Without that shift modelled here, the old
        measurement feedback loop cannot show up in jsdom at all. */
    function stubLiveLayout(content: HTMLElement) {
      const original = Element.prototype.getBoundingClientRect;
      Element.prototype.getBoundingClientRect = function (this: Element) {
        if (this === content) {
          return { top: 100, left: 100, width: 260, height: 600, right: 360, bottom: 700, x: 100, y: 100, toJSON: () => ({}) } as DOMRect;
        }
        const el = this as HTMLElement;
        if (el.dataset && el.dataset.blockId) {
          const kids = Array.from(content.children);
          const lineAt = kids.findIndex((k) => k.classList.contains('pv-drop-line'));
          const blocks = kids.filter((k) => (k as HTMLElement).dataset && (k as HTMLElement).dataset.blockId);
          const i = blocks.indexOf(el);
          const pushed = lineAt >= 0 && kids.indexOf(el) > lineAt ? 30 : 0;
          const top = 100 + Math.max(0, i) * 100 + pushed;
          return { top, left: 100, width: 260, height: 90, right: 360, bottom: top + 90, x: 100, y: top, toJSON: () => ({}) } as DOMRect;
        }
        return original.call(this);
      };
      return () => {
        Element.prototype.getBoundingClientRect = original;
      };
    }

    it('drops a section where the pointer is, not just under the profile', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      const restore = stubLiveLayout(content);
      const before = container.querySelectorAll('[data-block-id]').length;

      const card = screen.getByLabelText('Add Email Support section');
      fireEvent.pointerDown(card, { button: 0, pointerId: 21, clientX: 20, clientY: 20 });
      // Drag to the very bottom, then hold there across several moves: the
      // target must not creep back up toward the profile between events.
      for (const y of [660, 655, 650]) {
        fireEvent.pointerMove(window, { pointerId: 21, clientX: 200, clientY: y });
      }
      fireEvent.pointerUp(window, { pointerId: 21, clientX: 200, clientY: 650 });
      restore();

      const blocks = container.querySelectorAll('[data-block-id]');
      expect(blocks.length).toBe(before + 1);
      expect(blocks[0].classList.contains('pv-profile')).toBe(true);
      // Released at the bottom, so it belongs last - not tucked under the profile.
      expect(blocks[blocks.length - 1].querySelector('.pv-support')).toBeTruthy();
    });

    it('scrolls the page under a palette drag so lower positions are reachable', async () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      const phoneScreen = container.querySelector('.pv-screen') as HTMLElement;
      // jsdom has no layout, so scrolling is inert unless these are faked.
      Object.defineProperty(phoneScreen, 'scrollHeight', { configurable: true, value: 3000 });
      Object.defineProperty(phoneScreen, 'clientHeight', { configurable: true, value: 600 });
      Object.defineProperty(phoneScreen, 'scrollTop', { configurable: true, writable: true, value: 0 });

      const card = screen.getByLabelText('Add Email Support section');
      fireEvent.pointerDown(card, { button: 0, pointerId: 31, clientX: 20, clientY: 20 });
      // Hold at the bottom edge of the frame. Without auto-scroll on the
      // palette gesture, anything past the fold is simply unreachable.
      fireEvent.pointerMove(window, { pointerId: 31, clientX: 200, clientY: 690 });
      await new Promise((r) => { requestAnimationFrame(() => r(null)); });
      await new Promise((r) => { requestAnimationFrame(() => r(null)); });
      expect(phoneScreen.scrollTop).toBeGreaterThan(0);
      fireEvent.pointerUp(window, { pointerId: 31, clientX: 200, clientY: 690 });
    });

    it('creates a section only when the palette drag is released inside the phone', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      const before = container.querySelectorAll('[data-block-id]').length;

      const card = screen.getByLabelText('Add Email Support section');
      fireEvent.pointerDown(card, { button: 0, pointerId: 7, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(window, { pointerId: 7, clientX: 20, clientY: 20 });
      fireEvent.pointerUp(window, { pointerId: 7, clientX: 20, clientY: 20 });
      expect(container.querySelectorAll('[data-block-id]').length).toBe(before);

      // Drag released inside the phone → section is created.
      fireEvent.pointerDown(card, { button: 0, pointerId: 8, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(window, { pointerId: 8, clientX: 200, clientY: 400 });
      fireEvent.pointerUp(window, { pointerId: 8, clientX: 200, clientY: 400 });
      expect(container.querySelectorAll('[data-block-id]').length).toBe(before + 1);
    });

    it('highlights the phone drop area only while dragging over it', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      const phone = container.querySelector('.pv-phone') as HTMLElement;
      const card = screen.getByLabelText('Add Upload Digital Product section');

      fireEvent.pointerDown(card, { button: 0, pointerId: 9, clientX: 10, clientY: 10 });
      expect(phone.classList.contains('is-palette-drag')).toBe(true);
      // Pointer still outside the phone content area.
      expect(container.querySelector('.pv-dropzone')).toBeTruthy();
      expect(phone.classList.contains('is-drop-over')).toBe(false);

      fireEvent.pointerMove(window, { pointerId: 9, clientX: 200, clientY: 400 });
      expect(phone.classList.contains('is-drop-over')).toBe(true);
      fireEvent.pointerUp(window, { pointerId: 9, clientX: 200, clientY: 400 });
      expect(phone.classList.contains('is-drop-over')).toBe(false);
    });

    it('does not add a section when the palette card is only clicked', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const before = container.querySelectorAll('[data-block-id]').length;
      // A bare pointerdown/up on the card (no move into the phone) must not add.
      fireEvent.pointerDown(screen.getByLabelText('Add Digital Product Video Preview section'), { button: 0, pointerId: 11, clientX: 5, clientY: 5 });
      fireEvent.pointerUp(window, { pointerId: 11, clientX: 5, clientY: 5 });
      expect(container.querySelectorAll('[data-block-id]').length).toBe(before);
    });

    it('never lets the pinned profile be duplicated or displaced', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      const restore = stubLiveLayout(content);
      expect(container.querySelectorAll('.pv-profile').length).toBe(1);

      const before = container.querySelectorAll('[data-block-id]').length;
      const card = screen.getByLabelText('Add Email Support section');
      // Drop far above the profile block → must not land above/over it.
      fireEvent.pointerDown(card, { button: 0, pointerId: 12, clientX: 20, clientY: 20 });
      fireEvent.pointerMove(window, { pointerId: 12, clientX: 200, clientY: 110 });
      fireEvent.pointerUp(window, { pointerId: 12, clientX: 200, clientY: 110 });
      restore();
      const blocks = container.querySelectorAll('[data-block-id]');
      expect(blocks.length).toBe(before + 1);
      expect(blocks[0].classList.contains('pv-profile')).toBe(true);
    });

    it('reorders an existing section by dragging inside the phone', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      const ids = Array.from(container.querySelectorAll('[data-block-id]')).map((el) => (el as HTMLElement).dataset.blockId!);
      const restore = stubLiveLayout(content);
      // Use the TikTok block: it renders plain markup, so the gesture is not
      // blocked by an inner form control (the newsletter block has an input).
      const dragId = ids[1];
      const dragEl = container.querySelector(`[data-block-id="${dragId}"]`) as HTMLElement;

      // Grab it and drop near the bottom of the phone. pointerType must be
      // set (real browsers always send it): touch drags require the grip.
      fireEvent.pointerDown(dragEl, { button: 0, pointerId: 21, pointerType: 'mouse', clientX: 200, clientY: 200 });
      fireEvent.pointerMove(window, { pointerId: 21, clientX: 200, clientY: 690 });
      fireEvent.pointerUp(window, { pointerId: 21, clientX: 200, clientY: 690 });

      const after = Array.from(container.querySelectorAll('[data-block-id]')).map((el) => (el as HTMLElement).dataset.blockId!);
      restore();
      expect(after.length).toBe(ids.length);
      expect(after[0]).toBe(ids[0]); // profile stays pinned at the top
      expect(after[1]).not.toBe(dragId); // it left its original slot
      expect(after[after.length - 1]).toBe(dragId); // and landed at the bottom
    });

    it('persists a dropped section across a remount', () => {
      seedConnected();
      const first = render(<CreatorStorePage />);
      const content = first.container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      const before = first.container.querySelectorAll('[data-block-id]').length;
      fireEvent.pointerDown(screen.getByLabelText('Add Email Support section'), { button: 0, pointerId: 31, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(window, { pointerId: 31, clientX: 200, clientY: 400 });
      fireEvent.pointerUp(window, { pointerId: 31, clientX: 200, clientY: 400 });
      expect(first.container.querySelectorAll('[data-block-id]').length).toBe(before + 1);

      first.unmount();
      cleanup();
      const second = render(<CreatorStorePage />);
      expect(second.container.querySelectorAll('[data-block-id]').length).toBe(before + 1);
    });

    it('undoes and redoes a palette drop', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      const before = container.querySelectorAll('[data-block-id]').length;

      fireEvent.pointerDown(screen.getByLabelText('Add Upload Digital Product section'), { button: 0, pointerId: 41, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(window, { pointerId: 41, clientX: 200, clientY: 400 });
      fireEvent.pointerUp(window, { pointerId: 41, clientX: 200, clientY: 400 });
      expect(container.querySelectorAll('[data-block-id]').length).toBe(before + 1);

      fireEvent.click(screen.getByRole('button', { name: 'Undo' }));
      expect(container.querySelectorAll('[data-block-id]').length).toBe(before);
      fireEvent.click(screen.getByRole('button', { name: 'Redo' }));
      expect(container.querySelectorAll('[data-block-id]').length).toBe(before + 1);
    });

    it('offers only the three Creator Store sections, including Email Support', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      expect(screen.getByLabelText('Add Upload Digital Product section')).toBeTruthy();
      expect(screen.getByLabelText('Add Digital Product Video Preview section')).toBeTruthy();
      expect(screen.getByLabelText('Add Email Support section')).toBeTruthy();
      expect(screen.queryByLabelText('Add Text section')).toBeNull();
      expect(screen.queryByLabelText('Add Divider / Spacer section')).toBeNull();
      fireEvent.pointerDown(screen.getByLabelText('Add Email Support section'), { button: 0, pointerId: 51, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(window, { pointerId: 51, clientX: 200, clientY: 400 });
      fireEvent.pointerUp(window, { pointerId: 51, clientX: 200, clientY: 400 });
      expect(container.querySelectorAll('.pv-support').length).toBe(1);
    });

    it('creates a Digital Product Video Preview with swipe buy panes', () => {
      seedConnected();
      const { container } = render(<CreatorStorePage />);
      const content = container.querySelector('.pv-content') as HTMLElement;
      stubContentBox(content);
      fireEvent.pointerDown(screen.getByLabelText('Add Digital Product Video Preview section'), { button: 0, pointerId: 52, clientX: 10, clientY: 10 });
      fireEvent.pointerMove(window, { pointerId: 52, clientX: 200, clientY: 400 });
      fireEvent.pointerUp(window, { pointerId: 52, clientX: 200, clientY: 400 });
      expect(container.querySelectorAll('.pv-showcase').length).toBe(1);
      expect(container.querySelector('.pv-showcase__buybtn')?.textContent).toMatch(/Buy Now/);
    });
  });
});
