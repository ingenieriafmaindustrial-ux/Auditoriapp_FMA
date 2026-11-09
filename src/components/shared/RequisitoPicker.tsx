import { useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Search } from 'lucide-react';
import { Button, Input, Modal } from '../ui';
import { useData } from '../../context/DataContext';
import { cn, normalizar } from '../../lib/utils';
import type { Norma } from '../../types';

export const etiquetaRequisito = (r: { norma: string; clausula: string; titulo: string }) => `${r.norma} · ${r.clausula} ${r.titulo}`;

/** Resumen compacto + modal de selección múltiple con búsqueda, filtrado por normas de la auditoría. */
export function RequisitoPicker({ value, onChange, normas, disabled }: { value: string[]; onChange: (ids: string[]) => void; normas: Norma[]; disabled?: boolean }) {
  const { requisitos, mapa } = useData();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState<string[]>(value);
  const [abiertas, setAbiertas] = useState<Record<string, boolean>>({});

  const lista = useMemo(() => {
    const nq = normalizar(q);
    return requisitos.filter(
      (r) => r.activo && (!normas.length || normas.includes(r.norma)) && (!nq || normalizar(`${r.clausula} ${r.titulo}`).includes(nq)),
    );
  }, [requisitos, normas, q]);

  const NOMBRES: Record<string, string> = { 'ISO 9001': 'Calidad', 'ISO 14001': 'Medio ambiente', 'ISO 45001': 'Seguridad y salud en el trabajo' };
  const grupos = useMemo(() => {
    const orden: Norma[] = ['ISO 9001', 'ISO 14001', 'ISO 45001'];
    return orden.map((n) => ({ norma: n, items: lista.filter((r) => r.norma === n) })).filter((g) => g.items.length);
  }, [lista]);
  const estaAbierta = (n: string) => (q.trim() ? true : abiertas[n] ?? sel.some((id) => mapa.requisitos[id]?.norma === n));

  return (
    <div>
      {value.length === 0 && <span className="text-sm text-zinc-500">Sin requisitos seleccionados</span>}
      <div className="space-y-1">
        {(['ISO 9001', 'ISO 14001', 'ISO 45001'] as const).map((n) => {
          const ids = value.filter((id) => mapa.requisitos[id]?.norma === n);
          return ids.length ? (
            <div key={n} className="flex flex-wrap items-center gap-1.5">
              <span className="w-20 text-[11px] font-bold uppercase text-zinc-500">{n}</span>
              {ids.map((id) => <span key={id} className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-800" title={mapa.requisitos[id].titulo}>{mapa.requisitos[id].clausula}</span>)}
            </div>
          ) : null;
        })}
        {value.filter((id) => !mapa.requisitos[id]).map((id) => <span key={id} className="rounded bg-zinc-100 px-2 py-0.5 text-xs">{id}</span>)}
      </div>
      {!disabled && (
        <Button
          type="button"
          size="sm"
          className="mt-2"
          onClick={() => {
            setSel(value);
            setOpen(true);
          }}
        >
          Seleccionar requisitos
        </Button>
      )}
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        size="lg"
        title={`Requisitos (${sel.length} seleccionados)`}
        footer={
          <>
            <Button onClick={() => setOpen(false)}>Cancelar</Button>
            <Button
              variant="primary"
              onClick={() => {
                onChange(sel);
                setOpen(false);
              }}
            >
              Aplicar
            </Button>
          </>
        }
      >
        <div className="relative mb-3">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input className="pl-9" placeholder="Buscar cláusula o título…" value={q} onChange={(e) => setQ(e.target.value)} autoFocus />
        </div>
        <div className="space-y-2">
          {grupos.map((g) => {
            const abierta = estaAbierta(g.norma);
            const n = sel.filter((id) => mapa.requisitos[id]?.norma === g.norma).length;
            return (
              <section key={g.norma} className="overflow-hidden rounded-xl border border-zinc-200">
                <button
                  type="button"
                  aria-expanded={abierta}
                  onClick={() => setAbiertas({ ...abiertas, [g.norma]: !abierta })}
                  className="flex w-full items-center gap-2 bg-zinc-50 px-3 py-2.5 text-left hover:bg-zinc-100"
                >
                  {abierta ? <ChevronDown className="h-4 w-4 text-zinc-500" /> : <ChevronRight className="h-4 w-4 text-zinc-500" />}
                  <span className="text-sm font-bold text-zinc-900">{g.norma}</span>
                  <span className="text-xs text-zinc-500">{NOMBRES[g.norma]}</span>
                  <span className={cn('ml-auto rounded-full px-2 py-0.5 text-[11px] font-bold', n ? 'bg-panel text-white' : 'bg-zinc-200 text-zinc-600')}>{n ? `${n} seleccionado${n > 1 ? 's' : ''}` : `${g.items.length} cláusulas`}</span>
                </button>
                {abierta && (
                  <ul className="max-h-72 divide-y divide-zinc-100 overflow-y-auto">
                    {g.items.map((r) => {
                      const on = sel.includes(r.id);
                      const nivel = r.clausula.split('.').length - 1;
                      return (
                        <li key={r.id}>
                          <label className="flex cursor-pointer items-start gap-2 py-1.5 pr-3 text-sm hover:bg-zinc-50" style={{ paddingLeft: 12 + nivel * 14 }}>
                            <input type="checkbox" className="mt-1 accent-panel" checked={on} onChange={() => setSel(on ? sel.filter((x) => x !== r.id) : [...sel, r.id])} />
                            <span><b>{r.clausula}</b> {r.titulo}</span>
                          </label>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            );
          })}
        </div>
        {!lista.length && <p className="text-sm text-zinc-500">Sin resultados. ¿Cargaste los requisitos en Catálogos?</p>}
      </Modal>
    </div>
  );
}
