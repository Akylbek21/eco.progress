// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import ProtocolSamplingPointsForm from '../src/components/protocols/ProtocolSamplingPointsForm';

afterEach(cleanup);

describe('ProtocolSamplingPointsForm', () => {
  it('lets an existing ambient-air draft add its first sampling point', () => {
    const onChange = vi.fn();
    render(<ProtocolSamplingPointsForm points={[]} results={[]} onChange={onChange} onSave={vi.fn()} />);

    fireEvent.click(screen.getByRole('button', { name: 'Добавить место отбора' }));

    expect(onChange).toHaveBeenCalledWith([
      expect.objectContaining({ name: 'Место отбора 1', sortOrder: 0 }),
    ]);
  });

  it('does not remove a sampling point already used by a result', () => {
    const onChange = vi.fn();
    render(<ProtocolSamplingPointsForm
      points={[{ id: 3, name: 'ТК-01 — Северная', sortOrder: 0 }]}
      results={[{ id: 'result-1', samplingPointId: 3, values: {} }]}
      onChange={onChange}
      onSave={vi.fn()}
    />);

    expect((screen.getByRole('button', { name: 'Удалить точку 1' }) as HTMLButtonElement).disabled).toBe(true);
    expect(onChange).not.toHaveBeenCalled();
  });
});
