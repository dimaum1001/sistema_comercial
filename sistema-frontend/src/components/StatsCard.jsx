const formatPercentLabel = (value) => {
  if (!Number.isFinite(value)) {
    return ''
  }

  const abs = Math.abs(value)
  const formatted = abs.toLocaleString('pt-BR', {
    minimumFractionDigits: abs % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })
  const sign = value > 0 ? '+' : value < 0 ? '-' : ''
  return `${sign}${formatted}% em relação ao mês passado`
}

export default function StatsCard({ title, value, percent, icon }) {
  const percentNumber = Number.isFinite(Number(percent)) ? Number(percent) : NaN
  const changeText = formatPercentLabel(percentNumber)
  const hasTrend = Boolean(changeText)

  const trendValue = Number.isFinite(percentNumber)
    ? percentNumber
    : changeText.startsWith('+')
      ? 1
      : changeText.startsWith('-')
        ? -1
        : 0

  const trendClass =
    trendValue > 0 ? 'text-green-500' : trendValue < 0 ? 'text-red-500' : 'text-gray-500'

  const UpIcon = (
    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
    </svg>
  )

  const DownIcon = (
    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
    </svg>
  )

  const FlatIcon = (
    <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 12h16" />
    </svg>
  )

  const TrendIcon = trendValue > 0 ? UpIcon : trendValue < 0 ? DownIcon : FlatIcon

  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
      <div className="flex justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-2xl font-bold text-gray-800 mt-1">{value}</p>
        </div>
        <div className="h-12 w-12 rounded-lg bg-opacity-20 flex items-center justify-center">
          {icon}
        </div>
      </div>
      {hasTrend && (
        <div className={`flex items-center mt-3 text-sm ${trendClass}`}>
          {TrendIcon}
          <span>{changeText}</span>
        </div>
      )}
    </div>
  )
}
