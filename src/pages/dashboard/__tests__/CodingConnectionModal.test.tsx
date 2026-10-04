import React, { useState } from 'react';
import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CodingConnectionModal } from '../monitor/CodingConnectionModal';
import { monitorApi } from '../monitor/monitorApi';
import type { ProviderId } from '../monitor/types';
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it('switches exclusively between saved keys without reopening key entry', () => {
  function Example() {
    const [selected, select] = useState<ProviderId | null>(null);
    return <CodingConnectionModal token="token" providers={['openai', 'anthropic'].map(provider => ({ provider: provider as ProviderId, connected: true, keyLast4: '1234' }))} selectedProvider={selected} onSelect={select} onClose={() => {}} onChanged={() => {}} />;
  }
  render(<Example />);
  expect(document.querySelectorAll('.mm-provider-dot.is-selected')).toHaveLength(0);
  const openai = screen.getByRole('button', { name: 'Use OpenAI API' });
  const anthropic = screen.getByRole('button', { name: 'Use Anthropic API' });
  fireEvent.click(openai);
  expect(openai.getAttribute('aria-pressed')).toBe('true');
  fireEvent.click(anthropic);
  expect(openai.getAttribute('aria-pressed')).toBe('false');
  expect(anthropic.getAttribute('aria-pressed')).toBe('true');
  expect(document.querySelectorAll('.mm-provider-dot.is-selected')).toHaveLength(1);
  expect(screen.queryByText('API key')).toBeNull();
});

it.each(['openai', 'anthropic'] as const)('opens and saves the correct %s key before selecting', async provider => {
  const select = vi.fn();
  const save = vi.spyOn(monitorApi, 'saveProvider').mockResolvedValue({ ok: true, data: { provider, connected: true, keyLast4: '1234' } });
  render(<CodingConnectionModal token="token" providers={[]} selectedProvider={null} onSelect={select} onClose={() => {}} onChanged={() => {}} />);
  fireEvent.click(screen.getByRole('button', { name: `Connect API Key for ${provider === 'openai' ? 'OpenAI' : 'Anthropic'} API` }));
  expect(select).not.toHaveBeenCalled();
  fireEvent.change(screen.getByLabelText('API key'), { target: { value: 'sk-test-key-1234' } });
  fireEvent.click(screen.getByRole('button', { name: 'Connect' }));
  await screen.findByRole('dialog', { name: 'Connect coding agent' });
  expect(save).toHaveBeenCalledWith('token', provider, 'sk-test-key-1234', 'api');
  expect(select).toHaveBeenCalledExactlyOnceWith(provider);
});
