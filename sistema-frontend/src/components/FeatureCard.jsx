export default function FeatureCard({ title, description, icon, onView, onAdd }) {
  return (
    <div className="card-soft group flex h-full flex-col gap-6 rounded-3xl border border-slate-100/70 bg-white/80 p-6 shadow-sm transition hover:-translate-y-1 hover:shadow-lg">
      <div className="flex items-center gap-4">
        <div className="rounded-2xl border border-slate-100 bg-blue-50 p-3 text-blue-500">
          {icon}
        </div>
        <div>
          <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
          <p className="text-sm text-slate-500">{description}</p>
        </div>
      </div>
      <div className="mt-auto flex items-center justify-between">
        <button
          onClick={onView}
          type="button"
          className="btn-ghost text-sm"
        >
          Ver todos
        </button>
        <button onClick={onAdd} type="button" className="btn-primary text-sm">
          Adicionar
        </button>
      </div>
    </div>
  );
}
