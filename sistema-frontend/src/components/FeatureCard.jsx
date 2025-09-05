export default function FeatureCard({ title, description, icon, onView, onAdd }) {
  return (
    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 hover:shadow-md transition">
      <div className="flex items-center mb-4">
        <div className="mr-4">
          {icon}
        </div>
        <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
      </div>
      <p className="text-gray-600 mb-6">{description}</p>
      <div className="flex justify-between">
        <button
          onClick={onView}
          className="text-sm font-medium text-blue-600 hover:text-blue-700 flex items-center transition"
        >
          Ver todos
          <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
          </svg>
        </button>
        <button
          onClick={onAdd}
          className="text-sm font-medium bg-blue-600 text-white px-3 py-1 rounded-md hover:bg-blue-700 transition"
        >
          Adicionar
        </button>
      </div>
    </div>
  )
}