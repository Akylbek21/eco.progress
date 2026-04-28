import { ReactNode } from 'react';
import { Link } from 'react-router-dom';

type PageHeaderProps = {
  title: string;
  description?: string;
  crumbs?: { label: string; path?: string }[];
  actions?: ReactNode;
};

const PageHeader = ({ title, description, crumbs, actions }: PageHeaderProps) => {
  return (
    <div className="mb-10 rounded-[28px] border border-slate-200 bg-white px-6 py-6 shadow-sm shadow-slate-200/40 sm:px-8">
      {crumbs && crumbs.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-2 text-sm text-slate-500">
          {crumbs.map((crumb, index) => (
            <span key={crumb.label} className="inline-flex items-center gap-2">
              {crumb.path ? (
                <Link to={crumb.path} className="text-eco-700 hover:text-eco-800">
                  {crumb.label}
                </Link>
              ) : (
                <span>{crumb.label}</span>
              )}
              {index < crumbs.length - 1 && <span>›</span>}
            </span>
          ))}
        </div>
      )}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">{title}</h1>
          {description && <p className="mt-3 text-slate-600">{description}</p>}
        </div>
        {actions}
      </div>
    </div>
  );
};

export default PageHeader;
