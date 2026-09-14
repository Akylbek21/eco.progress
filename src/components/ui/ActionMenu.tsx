import { MoreVertical } from 'lucide-react';
import type { ReactNode } from 'react';

type ActionMenuProps = {
  children: ReactNode;
  label?: string;
  disabled?: boolean;
  widthClass?: string;
};

const ActionMenu = ({ children, label = 'Действия', disabled = false, widthClass = 'w-52' }: ActionMenuProps) => (
  <details className="action-menu group relative inline-block text-left">
    <summary
      onClick={(event) => { if (disabled) event.preventDefault(); }}
      className={`flex size-10 list-none items-center justify-center rounded-xl border border-slate-200 bg-white text-eco-900 transition [&::-webkit-details-marker]:hidden ${disabled ? 'cursor-wait opacity-50' : 'cursor-pointer hover:bg-slate-50'}`}
      aria-label={label}
      title={label}
    >
      <MoreVertical size={20} />
    </summary>
    <div className={`absolute right-0 z-30 mt-2 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-xl ${widthClass} [&_a]:flex [&_a]:w-full [&_a]:items-center [&_a]:gap-2 [&_a]:px-4 [&_a]:py-2.5 [&_a]:text-left [&_a]:font-semibold [&_button]:flex [&_button]:min-h-0 [&_button]:w-full [&_button]:items-center [&_button]:justify-start [&_button]:gap-2 [&_button]:rounded-none [&_button]:border-0 [&_button]:bg-transparent [&_button]:px-4 [&_button]:py-2.5 [&_button]:text-left [&_button]:font-semibold [&_button]:shadow-none [&_a:hover]:bg-slate-50 [&_button:hover]:bg-slate-50`}>
      {children}
    </div>
  </details>
);

export default ActionMenu;
