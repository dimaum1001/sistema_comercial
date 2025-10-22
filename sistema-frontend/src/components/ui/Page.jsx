import { classNames } from '../../utils/classNames';
import PageHeader from './PageHeader';

export default function Page({
  title,
  subtitle = '',
  icon = null,
  actions = null,
  headerContent = null,
  children,
  className = '',
  contentClassName = '',
}) {
  return (
    <div className={classNames('page-container', className)}>
      <PageHeader title={title} subtitle={subtitle} icon={icon} actions={actions}>
        {headerContent}
      </PageHeader>
      <div className={classNames('space-y-6', contentClassName)}>{children}</div>
    </div>
  );
}
