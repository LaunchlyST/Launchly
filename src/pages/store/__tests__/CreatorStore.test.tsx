import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { CreatorStorePage } from '../CreatorStorePage';

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe('CreatorStorePage', () => {
  it('renders storefront, products and payments sections', () => {
    render(<CreatorStorePage />);
    expect(screen.getByRole('heading', { name: 'Creator Store' })).toBeTruthy();
    expect(screen.getByLabelText('Store handle')).toBeTruthy();
    expect(screen.getByLabelText('Payment provider')).toBeTruthy();
    expect(screen.getByText(/Share in your TikTok bio/)).toBeTruthy();
  });

  it('shows seeded products and lets users add one', () => {
    render(<CreatorStorePage />);
    expect(screen.getAllByTestId('store-product').length).toBeGreaterThan(0);
    fireEvent.click(screen.getByRole('button', { name: /Add product/ }));
    fireEvent.change(screen.getByLabelText('Product name'), { target: { value: 'Test Ebook' } });
    fireEvent.click(screen.getByRole('button', { name: /Save product/ }));
    expect(screen.getAllByText('Test Ebook').length).toBeGreaterThan(0);
  });

  it('checkout creates an order', () => {
    render(<CreatorStorePage />);
    const buyButtons = screen.getAllByRole('button', { name: 'Buy' });
    expect(buyButtons.length).toBeGreaterThan(0);
    fireEvent.click(buyButtons[0]);
    expect(screen.getByText(/Checkout started|Order placed/)).toBeTruthy();
  });
});
