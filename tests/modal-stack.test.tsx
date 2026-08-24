// @vitest-environment jsdom
import { fireEvent, render, screen } from '@testing-library/react';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';
import Modal from '../src/components/ui/Modal';

describe('modal stack', () => {
  it('lets only the top modal handle Escape', () => {
    const closeOuter = vi.fn();
    const closeInner = vi.fn();
    const Harness = () => {
      const [innerOpen, setInnerOpen] = useState(false);
      return <Modal open ariaLabel="Создание протокола" onClose={closeOuter}>
        <button type="button" onClick={() => setInnerOpen(true)}>Открыть нормативы</button>
        <Modal open={innerOpen} title="Выбор норматива" onClose={() => { closeInner(); setInnerOpen(false); }}>Содержимое</Modal>
      </Modal>;
    };

    render(<Harness />);

    expect(screen.getByRole('dialog', { name: 'Создание протокола' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Открыть нормативы' }));
    expect(screen.getByRole('dialog', { name: 'Выбор норматива' })).toBeTruthy();
    fireEvent.keyDown(window, { key: 'Escape' });

    expect(closeInner).toHaveBeenCalledTimes(1);
    expect(closeOuter).not.toHaveBeenCalled();
  });

  it('uses unique accessible labels for titled dialogs', () => {
    render(<>
      <Modal open title="Первый диалог" onClose={vi.fn()}>Первый</Modal>
      <Modal open title="Второй диалог" onClose={vi.fn()}>Второй</Modal>
    </>);

    expect(screen.getByRole('dialog', { name: 'Первый диалог' })).toBeTruthy();
    expect(screen.getByRole('dialog', { name: 'Второй диалог' })).toBeTruthy();
  });
});
