import { classNames } from '../../utils/classNames';

export default function PageHeader({
  title,
  subtitle,
  icon = null,
  actions = null,
  children = null,
  className = '',
}) {
  return (
    <header
      className={classNames(
        'card-soft flex flex-col gap-4 rounded-3xl border border-blue-50 bg-gradient-to-r from-white via-white to-blue-50/80 px-6 py-5 shadow-sm md:flex-row md:items-center md:justify-between',
        className,
      )}
    >
      <div className="flex items-start gap-4">
        {icon && (
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
            {typeof icon === 'function' ? icon() : icon}
          </div>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-slate-900">{title}</h1>
          {subtitle && <p className="text-sm text-slate-600">{subtitle}</p>}
          {children}
        </div>
      </div>
      {actions && <div className="flex flex-col gap-3 md:flex-row">{actions}</div>}
    </header>
  );
}
