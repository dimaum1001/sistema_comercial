const formatPercentLabel = (value) => {
  if (!Number.isFinite(value)) {
    return '';
  }

  const abs = Math.abs(value);
  const formatted = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
  const sign = value > 0 ? '+' : value < 0 ? '-' : '';
  return `${sign}${formatted}% em relacao ao mes passado`;
};

export default function StatsCard({ title, value, percent, icon }) {
  const percentNumber = Number.isFinite(Number(percent)) ? Number(percent) : NaN;
  const changeText = formatPercentLabel(percentNumber);
  const hasTrend = Boolean(changeText);

  const trendValue = Number.isFinite(percentNumber)
    ? percentNumber
    : changeText.startsWith('+')
    ? 1
    : changeText.startsWith('-')
    ? -1
    : 0;

  const trendClass =
    trendValue > 0 ? 'text-emerald-500' : trendValue < 0 ? 'text-rose-500' : 'text-slate-500';

  const UpIcon = (
    <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  );

  const DownIcon = (
    <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  );

  const FlatIcon = (
    <svg className="mr-1 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16" />
    </svg>
  );

  const TrendIcon = trendValue > 0 ? UpIcon : trendValue < 0 ? DownIcon : FlatIcon;

  return (
    <div className="card-soft flex h-full flex-col gap-4 rounded-3xl border border-slate-100/70 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="mt-1 text-2xl font-semibold text-slate-900">{value}</p>
        </div>
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-500">
          {icon}
        </div>
      </div>
      {hasTrend && (
        <div className={`flex items-center text-sm ${trendClass}`}>
          {TrendIcon}
          <span>{changeText}</span>
        </div>
      )}
    </div>
  );
}
