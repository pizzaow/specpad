import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import RefPicker from '../RefPicker';
import type { RefOption } from '../RefPicker';

// Every trace edge stores ids while a human thinks in codes. This is the translation.
const options: RefOption[] = [
  { id: 'd_001', code: 'SDD-1', text: 'auth' },
  { id: 'd_002', code: 'SDD-2', text: 'merge' },
  { id: 'd_003', code: 'SDD-3', text: 'report rendering' },
];

const open = () => fireEvent.click(screen.getByText(/add/));

describe('RefPicker', () => {
  it('shows selected references by code, never by id', () => {
    render(<RefPicker label="Design" value={['d_002']} options={options} onChange={vi.fn()} />);

    expect(screen.getByText('SDD-2')).toBeInTheDocument();
    expect(screen.queryByText('d_002')).toBeNull();
  });

  it('filters candidates by code and by text', () => {
    render(<RefPicker label="Design" value={[]} options={options} onChange={vi.fn()} />);
    open();

    fireEvent.change(screen.getByLabelText('Search Design'), { target: { value: 'render' } });
    expect(screen.getByRole('option', { name: /SDD-3/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /SDD-1/ })).toBeNull();

    fireEvent.change(screen.getByLabelText('Search Design'), { target: { value: 'sdd-1' } });
    expect(screen.getByRole('option', { name: /auth/ })).toBeInTheDocument();
  });

  it('stores the id of the chosen candidate', () => {
    const onChange = vi.fn();
    render(<RefPicker label="Design" value={['d_001']} options={options} onChange={onChange} />);
    open();

    fireEvent.mouseDown(screen.getByRole('option', { name: /SDD-3/ }));

    expect(onChange).toHaveBeenCalledWith(['d_001', 'd_003']);
  });

  it('selects the first match on Enter', () => {
    const onChange = vi.fn();
    render(<RefPicker label="Design" value={[]} options={options} onChange={onChange} />);
    open();

    const input = screen.getByLabelText('Search Design');
    fireEvent.change(input, { target: { value: 'merge' } });
    fireEvent.keyDown(input, { key: 'Enter' });

    expect(onChange).toHaveBeenCalledWith(['d_002']);
  });

  it('does not offer a candidate that is already selected', () => {
    render(<RefPicker label="Design" value={['d_001']} options={options} onChange={vi.fn()} />);
    open();

    expect(screen.queryByRole('option', { name: /auth/ })).toBeNull();
  });

  it('shows an unresolved reference rather than hiding it, and allows removing it', () => {
    const onChange = vi.fn();
    render(<RefPicker label="Design" value={['d_gone']} options={options} onChange={onChange} />);

    expect(screen.getByText(/d_gone \(unresolved\)/)).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText('Remove d_gone'));
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it('says when there is nothing to link to', () => {
    render(<RefPicker label="Design" value={[]} options={[]} onChange={vi.fn()} />);
    open();

    expect(screen.getByText(/Nothing to link to yet/)).toBeInTheDocument();
  });

  it('offers no controls when read-only', () => {
    render(<RefPicker label="Design" value={['d_001']} options={options} onChange={vi.fn()} readOnly />);

    expect(screen.getByText('SDD-1')).toBeInTheDocument();
    expect(screen.queryByText(/add/)).toBeNull();
    expect(screen.queryByLabelText('Remove SDD-1')).toBeNull();
  });
});
