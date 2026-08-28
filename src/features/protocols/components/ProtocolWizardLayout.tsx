import type { ReactNode } from 'react';

export default function ProtocolWizardLayout({ header, sidebar, summary, footer, children }: { header: ReactNode; sidebar: ReactNode; summary: ReactNode; footer: ReactNode; children: ReactNode }) {
  return <div data-testid="protocol-create-workspace" className="min-h-full overflow-x-clip bg-slate-50">
    <div className="mx-auto w-full max-w-[1500px] px-0 sm:px-4 lg:px-6">
      {header}
      <div className="overflow-hidden border-y border-slate-200 bg-white sm:rounded-2xl sm:border">
        <div className="grid min-w-0 lg:grid-cols-[230px_minmax(0,1fr)] xl:grid-cols-[230px_minmax(0,1fr)_300px]">
          {sidebar}
          <div className="min-w-0 bg-slate-50">
            <main className="min-w-0 p-4 sm:p-6 lg:p-7">{children}</main>
            {footer}
          </div>
          <div className="lg:col-start-2 xl:col-start-auto">{summary}</div>
        </div>
      </div>
    </div>
  </div>;
}
