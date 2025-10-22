import { classNames } from '../../utils/classNames';

export default function Card({
  title = '',
  description = '',
  actions = null,
  children,
  padding = 'p-6',
  className = '',
  bodyClassName = '',
}) {
  return (
    <section className={classNames('card-soft', className)}>
      {(title || description || actions) && (
        <div className="flex flex-col gap-3 border-b border-slate-100 px-6 py-4 md:flex-row md:items-start md:justify-between">
          <div className="space-y-1">
            {title && <h2 className="text-lg font-semibold text-slate-900">{title}</h2>}
            {description && <p className="text-sm text-slate-600">{description}</p>}
          </div>
          {actions && <div className="flex flex-col gap-2 md:flex-row">{actions}</div>}
        </div>
      )}
      <div className={classNames('space-y-4', padding, bodyClassName)}>{children}</div>
    </section>
  );
}
