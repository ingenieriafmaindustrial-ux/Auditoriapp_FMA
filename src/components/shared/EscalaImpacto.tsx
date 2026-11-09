import { useMemo, useState } from 'react';
import { ChevronDown, ChevronUp, Gauge } from 'lucide-react';
import { cn } from '../../lib/utils';
import { AFECTA, CRITERIOS, EXTENSION, calcularNivel, detectarFactores, type Afecta, type Extension, type Factores } from '../../domain/impacto';
import type { Nivel, TipoHallazgo } from '../../types';

const TONO: Record<Nivel, string> = {
  BAJA: 'bg-emerald-600 text-white',
  MEDIA: 'bg-amber-400 text-ink',
  ALTA: 'bg-red-600 text-white',
};

/**
 * Escala de impacto guiada: detecta en el texto qué afecta el hallazgo y qué tan extendido está,
 * el auditor ajusta y la escala propone BAJA / MEDIA / ALTA con sus fundamentos normativos.
 */
export function EscalaImpacto({ texto, tipo, nivel, reincidente, onNivel }: { texto: string; tipo: TipoHallazgo; nivel: Nivel; reincidente: boolean; onNivel: (n: Nivel) => void }) {
  const detectado = useMemo(() => detectarFactores(texto, reincidente), [texto, reincidente]);
  const [manual, setManual] = useState<Factores | null>(null);
  const [verCriterios, setVerCriterios] = useState(false);
  const f = manual ?? detectado;
  const r = calcularNivel(f, tipo);
  const cambiar = (x: Partial<Factores>) => setManual({ ...f, ...x });
  const toggleAfecta = (a: Afecta) => cambiar({ afecta: f.afecta.includes(a) ? f.afecta.filter((y) => y !== a) : [...f.afecta.filter((y) => (a === 'documental' ? false : y !== 'documental')), a] });

  if (texto.trim().length < 15) return null;
  return (
    <section className="rounded-xl border border-zinc-200 bg-zinc-50 p-3" aria-label="Escala de nivel de impacto">
      <div className="flex flex-wrap items-center gap-2">
        <Gauge className="h-4 w-4 text-zinc-600" />
        <span className="text-xs font-bold uppercase tracking-wide text-zinc-700">Escala de impacto</span>
        <span className="text-[11px] text-zinc-500">{manual ? 'ajustada por ti' : 'detectada del texto · ajústala si hace falta'}</span>
        <span className="ml-auto flex items-center gap-2">
          <span className="text-xs text-zinc-600">Sugerido:</span>
          <span className={cn('rounded-md px-2.5 py-1 text-xs font-bold', TONO[r.nivel])}>{r.nivel}</span>
          {r.nivel !== nivel ? (
            <button type="button" className="asis-accion asis-accion--primaria" onClick={() => onNivel(r.nivel)}>Usar {r.nivel}</button>
          ) : (
            <span className="text-[11px] font-semibold text-emerald-700">✓ aplicado</span>
          )}
        </span>
      </div>

      <div className="mt-2.5 grid gap-2.5 md:grid-cols-[1.4fr_1fr]">
        <div>
          <p className="mb-1 text-[11px] font-semibold text-zinc-600">¿Qué afecta?</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(AFECTA) as Afecta[]).map((a) => (
              <button key={a} type="button" title={`${AFECTA[a].ayuda} (${AFECTA[a].base})`} onClick={() => toggleAfecta(a)} aria-pressed={f.afecta.includes(a)}
                className={cn('rounded-full border px-2.5 py-1 text-[11px] transition', f.afecta.includes(a) ? 'border-panel bg-panel text-white' : 'border-zinc-300 bg-surface text-zinc-600 hover:border-zinc-500')}>
                {AFECTA[a].label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <p className="mb-1 text-[11px] font-semibold text-zinc-600">¿Qué tan extendido?</p>
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(EXTENSION) as Extension[]).map((e) => (
              <button key={e} type="button" title={EXTENSION[e].ayuda} onClick={() => cambiar({ extension: f.extension === e ? null : e })} aria-pressed={f.extension === e}
                className={cn('rounded-full border px-2.5 py-1 text-[11px] transition', f.extension === e ? 'border-panel bg-panel text-white' : 'border-zinc-300 bg-surface text-zinc-600 hover:border-zinc-500')}>
                {EXTENSION[e].label}
              </button>
            ))}
            <button type="button" onClick={() => cambiar({ reincidente: !f.reincidente })} aria-pressed={f.reincidente} title="Ya se levantó antes en el área (10.2)"
              className={cn('rounded-full border px-2.5 py-1 text-[11px] transition', f.reincidente ? 'border-red-600 bg-red-600 text-white' : 'border-zinc-300 bg-surface text-zinc-600 hover:border-zinc-500')}>
              Reincidente
            </button>
          </div>
        </div>
      </div>

      <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-600">
        {r.motivos.map((m) => <li key={m}>· {m}</li>)}
        <li className="font-semibold text-zinc-700">= {r.puntaje} punto(s) → {r.nivel} <span className="font-normal text-zinc-500">(0–1 Baja · 2–3 Media · 4+ Alta)</span></li>
      </ul>
      <div className="mt-1.5 flex flex-wrap items-center gap-3">
        <button type="button" className="flex items-center gap-1 text-[11px] font-semibold text-violet-600 hover:underline" onClick={() => setVerCriterios((v) => !v)} aria-expanded={verCriterios}>
          {verCriterios ? 'Ocultar criterios' : 'Ver criterios de la escala'} {verCriterios ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
        </button>
        {manual && <button type="button" className="text-[11px] text-zinc-500 underline" onClick={() => setManual(null)}>Volver a lo detectado</button>}
      </div>
      {verCriterios && (
        <div className="mt-2 space-y-1.5 rounded-lg border border-zinc-200 bg-surface p-2.5 text-[11px] text-zinc-600">
          {(['ALTA', 'MEDIA', 'BAJA'] as Nivel[]).map((n) => (
            <p key={n}><span className={cn('mr-1.5 rounded px-1.5 py-px font-bold', TONO[n])}>{n}</span>{CRITERIOS[n]}</p>
          ))}
          <p className="pt-1 text-zinc-500">Fundamento: ISO 19011:2018 §6.4.8 (graduar hallazgos por importancia y riesgo); ISO 45001 6.1.2 y 8.1.2; ISO 14001 6.1.2; requisitos legales 6.1.3; ISO 9001 8.7 y 9.1.2; reincidencia 10.2.</p>
        </div>
      )}
    </section>
  );
}
