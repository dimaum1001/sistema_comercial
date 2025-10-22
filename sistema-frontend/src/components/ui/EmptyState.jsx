import { classNames } from '../../utils/classNames';

export default function EmptyState({
  icon = null,
  title = 'Nada por aqui',
  description = '',
  actions = null,
  className = '',
}) {
  return (
    <div
      className={classNames(
        'card-soft flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-slate-200 bg-white/80 px-10 py-16 text-center',
        className,
      )}
    >
      {icon && (
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-100 text-blue-600">
          {icon}
        </div>
      )}
      <div className="space-y-2">
        <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
        {description && <p className="text-sm text-slate-600">{description}</p>}
      </div>
      {actions && <div className="flex flex-col gap-2 md:flex-row">{actions}</div>}
    </div>
  );
}
