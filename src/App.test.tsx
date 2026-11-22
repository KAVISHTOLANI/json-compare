import { describe, expect, it } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';

const wait = () => act(() => new Promise((r) => setTimeout(r, 260)));

describe('JSON Compare workflow', () => {
  it('compares the demo documents with array items matched by sku', async () => {
    window.location.hash = '/compare';
    render(<App />);
    await wait();
    expect(screen.getByTestId('total')).toHaveTextContent('10');
    expect(screen.getByText('$.items[sku="TEA-12"].qty')).toBeInTheDocument();
    expect(screen.getByText('$.customer.vip')).toBeInTheDocument();
  });

  it('reports syntax errors with a line number', async () => {
    window.location.hash = '/compare';
    render(<App />);
    fireEvent.change(screen.getByLabelText('Changed'), { target: { value: '{\n  "a": 1,\n}' } });
    await wait();
    expect(screen.getByText(/Line 3, column 1/)).toBeInTheDocument();
    expect(screen.getByText(/Fix the JSON errors above/)).toBeInTheDocument();
  });

  it('shows identical, filtered and empty states', async () => {
    window.location.hash = '/compare';
    const user = userEvent.setup();
    render(<App />);
    await wait();
    await user.click(screen.getByRole('radio', { name: 'Added' }));
    expect(screen.getAllByText('Added', { selector: 'td span' }).length).toBe(3);
    fireEvent.change(screen.getByLabelText('Original'), { target: { value: '{"b":2,"a":1}' } });
    fireEvent.change(screen.getByLabelText('Changed'), { target: { value: '{"a":1,"b":2}' } });
    await wait();
    expect(screen.getByText('No differences.')).toBeInTheDocument();
    await user.click(screen.getAllByRole('button', { name: 'Clear' })[0]);
    await user.click(screen.getAllByRole('button', { name: 'Clear' })[1]);
    await wait();
    expect(screen.getByText('Nothing to compare yet')).toBeInTheDocument();
  });
});
