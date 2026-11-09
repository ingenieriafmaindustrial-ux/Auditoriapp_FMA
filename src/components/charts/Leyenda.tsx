export function Leyenda({ items }: { items: { label: string; color: string; valor?: string | number }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          <span className="chip-dot" style={{ background: i.color }} />
          {i.label}
          {i.valor !== undefined && <b className="text-zinc-900">{i.valor}</b>}
        </li>
      ))}
    </ul>
  );
}
