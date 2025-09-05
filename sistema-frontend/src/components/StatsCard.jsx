export default function StatsCard({ title, value, change, icon }) {
  const isPositive = change.startsWith('+')
  
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
      <div className={`flex items-center mt-3 text-sm ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
        {isPositive ? (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18" />
          </svg>
        ) : (
          <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        )}
        <span>{change} em relação ao mês passado</span>
      </div>
    </div>
  )
}