export default function CardHeader({ title, subtitle, right }) {
  return (
    <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h3 className="card-title">{title}</h3>
        {subtitle && <p className="card-sub">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}
