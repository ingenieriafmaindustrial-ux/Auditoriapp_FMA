import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Ban, Check, ClipboardList, Download, Link2, ListPlus, RefreshCw, Sparkles, Trash2, TriangleAlert } from 'lucide-react';
import { Button, Input, Select } from '../../../components/ui';
import { useData } from '../../../context/DataContext';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { cn, errorMensaje } from '../../../lib/utils';
import { actualizarPlanDesdeArea, construirPlanAuditoria, ESTADOS_PUNTO, hallazgosFueraDelPlan, nuevoIdPunto, ORIGEN_PUNTO, pendientesAnteriores, resumenPlan, vincularPlan } from '../../../domain/plan';
import { esGestor } from '../../../domain/permisos';
import { mutarPlanAuditoria, registrarDescargaPlanPdf } from '../../../services/plan';
import { descargarPlanWord } from '../../../services/informeExport';
import { PlanPdfModal } from './PlanPdfModal';
import { AyudaMemoria } from '../../../components/shared/AyudaMemoria';
import { ayudaMemoria } from '../../../data/infoDocumentada';
import type { Auditoria, EstadoPunto, Hallazgo, Norma, PuntoPlanAuditoria } from '../../../types';

const TONO: Record<EstadoPunto, string> = {
  pendiente: 'border-zinc-300 text-zinc-500',
  conforme: 'border-emerald-600 bg-emerald-600 text-white',
  hallazgo: 'border-red-600 bg-red-600 text-white',
  no_aplica: 'border-zinc-500 bg-zinc-500 text-white',
};
const BARRA: Record<EstadoPunto, string> = { conforme: 'bg-emerald-500', hallazgo: 'bg-red-500', no_aplica: 'bg-zinc-400', pendiente: 'bg-zinc-200' };

/** Plan de auditoría dentro de la hoja: puntos del área, estado de cada uno y match con los hallazgos. */
export function PlanAuditoria({ auditoria: a, hallazgos, editable, onIrHallazgo }: {
  auditoria: Auditoria;
  hallazgos: Hallazgo[];
  editable: boolean;
  onIrHallazgo: (id: string) => void;
}) {
  const u = useUsuario();
  const notify = useToast();
  const { mapa, hallazgos: todos, auditorias } = useData();
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'hallazgo'>('todos');
  const [nuevoTitulo, setNuevoTitulo] = useState('');
  const [agregando, setAgregando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [pdfAbierto, setPdfAbierto] = useState(false);
  const plan = a.plan ?? [];
  const puedeEditarEstructura = editable && esGestor(u.rol);

  const vinculos = useMemo(() => vincularPlan(plan, hallazgos, mapa.requisitos), [plan, hallazgos, mapa.requisitos]);
  const r = resumenPlan(plan, vinculos);
  const fuera = hallazgosFueraDelPlan(plan, vinculos, hallazgos);
  const anterior = useMemo(() => pendientesAnteriores(a, auditorias, todos, mapa.requisitos), [a, auditorias, todos, mapa.requisitos]);

  /** Todas las escrituras leen el plan vigente (otro auditor puede estar marcando puntos a la vez). */
  const guardar = async (fn: (actual: PuntoPlanAuditoria[]) => PuntoPlanAuditoria[], detalle: string, msg?: string) => {
    setGuardando(true);
    try {
      await mutarPlanAuditoria(u, a, fn, detalle);
      if (msg) notify(msg);
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setGuardando(false);
    }
  };
  const cambiar = (id: string, fn: (p: PuntoPlanAuditoria) => PuntoPlanAuditoria, detalle: string) =>
    guardar((actual) => actual.map((p) => (p.id === id ? fn(p) : p)), detalle);
  const tituloCorto = (p: PuntoPlanAuditoria) => `«${p.titulo.length > 60 ? p.titulo.slice(0, 60) + '…' : p.titulo}»`;
  const nombreDe = (uid: string | null) => (uid ? (uid === u.id ? 'ti' : mapa.usuarios[uid]?.nombre.split(' ')[0] ?? 'otro usuario') : null);

  const construir = () =>
    construirPlanAuditoria({
      area: mapa.areas[a.areaId],
      hallazgosArea: todos.filter((h) => h.areaId === a.areaId && h.auditoriaId !== a.id),
      codigos: Object.fromEntries(auditorias.map((x) => [x.id, x.codigo])),
      requisitos: mapa.requisitos,
    });
  const generar = () => {
    const nuevo = construir();
    if (!nuevo.length) return notify('El área no tiene plan cargado ni NC abiertas. Carga el plan en Áreas.', 'error');
    void guardar((actual) => (actual.length ? actual : nuevo), `generado con ${nuevo.length} puntos`, `Plan generado con ${nuevo.length} puntos`);
  };
  const actualizar = () => {
    const nuevo = construir();
    if (!nuevo.some((p) => p.origen === 'plan')) return notify('El área no tiene plan cargado. Cárgalo en Áreas → Plan.', 'error');
    if (!confirm('Se reemplazarán los puntos por el plan vigente del área. Los puntos ya revisados (mismo texto) conservan su estado y hallazgos. ¿Continuar?')) return;
    void guardar((actual) => actualizarPlanDesdeArea(actual, nuevo), 'actualizado con el plan vigente del área', 'Plan actualizado');
  };

  const descargar = () =>
    descargarPlanWord({
      codigo: a.codigo,
      anio: a.anio,
      objetivos: a.objetivos,
      alcance: a.alcance,
      sucursal: mapa.sucursales[a.sucursalId]?.nombre ?? '',
      area: mapa.areas[a.areaId]?.nombre ?? '',
      fechaPlanificada: a.fechaPlanificada,
      auditorLider: mapa.auditores[a.auditorLiderId]?.nombre ?? '',
      equipo: a.equipoIds.map((x) => mapa.auditores[x]?.nombre).filter((x): x is string => !!x),
      auditados: a.auditadosTexto,
      normas: a.normas,
      puntos: plan.filter((p) => p.origen === 'plan' || p.origen === 'manual').map((p) => ({ titulo: p.titulo, grupo: '', requisitos: [], referencia: p.referencia })),
    }).catch((e) => notify(errorMensaje(e), 'error'));

  if (!plan.length)
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-xl border-2 border-dashed border-zinc-300 p-4">
        <ClipboardList className="h-6 w-6 text-zinc-400" />
        <p className="min-w-0 flex-1 text-sm text-zinc-600">
          Esta auditoría no tiene plan. {mapa.areas[a.areaId]?.plan?.length ? `El área tiene ${mapa.areas[a.areaId]!.plan!.length} puntos en su plantilla.` : 'El área aún no tiene plantilla de plan (Áreas → Plan).'}
        </p>
        {editable && <Button variant="primary" icon={<Sparkles className="h-4 w-4" />} loading={guardando} onClick={generar}>Generar plan</Button>}
      </div>
    );

  const visibles = plan.filter((p) => filtro === 'todos' || vinculos.get(p.id)?.estado === filtro);
  const numero = new Map(plan.map((p, i) => [p.id, i + 1]));

  return (
    <div className="space-y-4">
      {anterior && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-amber-950">
          <p className="flex items-start gap-2 text-sm font-semibold">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <span>
              Ojo: en la auditoría {anterior.previa.codigo} ({anterior.previa.anio}) de esta área faltaron por evaluar {anterior.puntos.length} de {anterior.total} puntos del plan.
              <span className="block text-xs font-normal">Aviso solo para auditores: no aparece en el informe ni en el plan que se envía al área.</span>
            </span>
          </p>
          <ul className="mt-2 space-y-1 pl-6 text-xs">
            {anterior.puntos.map((p) => (
              <li key={p.id} className={cn('list-disc', p.cubierto && 'text-amber-800/60 line-through')}>
                {p.titulo}
                {p.cubierto && <span className="ml-1 inline-block font-semibold">(ya evaluado en esta auditoría)</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Resumen de cobertura */}
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <p className="font-[family-name:var(--font-display)] text-2xl font-bold leading-none text-zinc-900">
            {r.revisados}/{r.total}
            <span className="ml-1.5 align-middle text-xs font-medium text-zinc-500">puntos revisados ({r.pct} %)</span>
          </p>
          <span className="flex flex-wrap gap-3 text-xs text-zinc-600">
            <span><b className="text-emerald-700">{r.conforme}</b> conformes</span>
            <span><b className="text-red-700">{r.hallazgo}</b> con hallazgo</span>
            <span><b>{r.noAplica}</b> no aplica</span>
            <span><b>{r.pendiente}</b> pendientes</span>
          </span>
          <span className="ml-auto flex gap-2">
            {puedeEditarEstructura && <Button size="sm" icon={<RefreshCw className="h-3.5 w-3.5" />} loading={guardando} onClick={actualizar} title="Actualizar con el plan vigente del área">Actualizar plan</Button>}
            <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={descargar}>Plan (Word)</Button>
            <Button size="sm" icon={<Download className="h-3.5 w-3.5" />} onClick={() => setPdfAbierto(true)}>Plan (PDF)</Button>
          </span>
        </div>
        <div className="mt-2 flex h-2.5 overflow-hidden rounded-full bg-zinc-200" role="img" aria-label={`${r.pct} % del plan revisado`}>
          {(['conforme', 'hallazgo', 'no_aplica'] as EstadoPunto[]).map((e) => {
            const n = e === 'conforme' ? r.conforme : e === 'hallazgo' ? r.hallazgo : r.noAplica;
            return n ? <span key={e} className={BARRA[e]} style={{ width: `${(n / r.total) * 100}%` }} /> : null;
          })}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {([['todos', `Todos (${r.total})`], ['pendiente', `Pendientes (${r.pendiente})`], ['hallazgo', `Con hallazgo (${r.hallazgo})`]] as const).map(([k, l]) => (
          <button key={k} type="button" className={cn('chip', filtro === k && '!border-panel !bg-panel !text-white')} onClick={() => setFiltro(k)}>{l}</button>
        ))}
        {!editable && <span className="ml-auto text-xs text-zinc-500">Auditoría cerrada: el plan queda como registro.</span>}
      </div>

      {visibles.length > 0 && (
        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Puntos a revisar durante la auditoría (orden del plan del área)</p>
          <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200">
            {visibles.map((p) => {
              const v = vinculos.get(p.id)!;
              const estado = v.estado;
              return (
                <li key={p.id} className={cn('flex flex-wrap items-start gap-x-3 gap-y-2 px-3 py-2.5', estado === 'pendiente' ? 'bg-surface' : estado === 'hallazgo' ? 'bg-red-50/40' : 'bg-zinc-50')}>
                  <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-[11px] font-bold text-zinc-600">{numero.get(p.id)}</span>
                  <div className="min-w-0 flex-1 basis-64">
                    <p className="text-sm font-medium text-zinc-900">
                      {p.titulo}
                      {p.origen !== 'plan' && <span className={cn('ml-2 rounded-full px-1.5 py-px align-middle text-[10px] font-bold uppercase', p.origen === 'nc_anterior' ? 'bg-red-100 text-red-700' : p.origen === 'recurrente' ? 'bg-violet-100 text-violet-700' : 'bg-zinc-200 text-zinc-700')}>{ORIGEN_PUNTO[p.origen]}</span>}
                    </p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-1 text-[11px] text-zinc-500">
                      {p.referencia && <span className="rounded bg-panel px-1.5 font-semibold text-brand">{p.referencia}</span>}
                      {p.requisitos.slice(0, 4).map((k) => <span key={k} className="rounded bg-zinc-100 px-1.5">{k.replace('ISO ', '').replace('|', ' ')}</span>)}
                      {p.requisitos.length > 4 && <span>+{p.requisitos.length - 4}</span>}
                      {p.hallazgoOrigenId && <Link to={`/hallazgos/${p.hallazgoOrigenId}`} className="font-semibold text-violet-600 hover:underline">Ver NC anterior</Link>}
                      {p.estado !== 'pendiente' && p.revisadoPor && (
                        <span className="rounded bg-emerald-50 px-1.5 font-medium text-emerald-800" title="Quién marcó este punto">✓ {nombreDe(p.revisadoPor)}</span>
                      )}
                    </p>
                    {(() => {
                      const k = p.requisitos.find((x) => ayudaMemoria(x.split('|')[0] as Norma, x.split('|')[1] ?? ''));
                      return k ? <AyudaMemoria norma={k.split('|')[0] as Norma} clausula={k.split('|')[1]} compacto /> : null;
                    })()}
                    {(v.explicitos.length > 0 || v.relacionados.length > 0) && (
                      <p className="mt-1 flex flex-wrap items-center gap-1 text-[11px]">
                        {v.explicitos.map((h) => (
                          <button key={h.id} type="button" onClick={() => onIrHallazgo(h.id)} className={cn('rounded-full px-2 font-bold text-white', h.tipo === 'NC' ? 'bg-red-600' : 'bg-sky-600')}>#{h.correlativo} {h.tipo}</button>
                        ))}
                        {v.relacionados.map((h) => (
                          <button key={h.id} type="button" onClick={() => onIrHallazgo(h.id)} title="Relacionado por cláusula o procedimiento. Asócialo para confirmarlo." className="rounded-full border border-dashed border-zinc-400 px-2 text-zinc-600">
                            <Link2 className="mr-0.5 inline h-3 w-3" />#{h.correlativo} relacionado
                          </button>
                        ))}
                        {editable && v.relacionados.length > 0 && (
                          <button type="button" className="font-semibold text-violet-600 hover:underline" onClick={() => cambiar(p.id, (x) => ({ ...x, hallazgoIds: [...new Set([...x.hallazgoIds, ...v.relacionados.map((h) => h.id)])], estado: 'hallazgo', revisadoPor: u.id }), `${tituloCorto(p)} asociado a hallazgo(s) ${v.relacionados.map((h) => '#' + h.correlativo).join(', ')}`)}>
                            Asociar
                          </button>
                        )}
                      </p>
                    )}
                    {estado === 'hallazgo' && !v.explicitos.length && !v.relacionados.length && (
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-amber-700"><TriangleAlert className="h-3 w-3" /> Marcado con hallazgo, pero aún no hay hallazgo asociado.</p>
                    )}
                  </div>
                  <div className="flex shrink-0 flex-wrap items-center gap-1">
                    {editable ? (
                      <>
                        {(['conforme', 'hallazgo', 'no_aplica'] as EstadoPunto[]).map((e) => (
                          <button
                            key={e}
                            type="button"
                            aria-pressed={p.estado === e}
                            onClick={() => {
                              const nuevoEstado = p.estado === e ? 'pendiente' : e;
                              void cambiar(p.id, (x) => ({ ...x, estado: nuevoEstado, revisadoPor: nuevoEstado === 'pendiente' ? null : u.id }), `${tituloCorto(p)} → ${ESTADOS_PUNTO[nuevoEstado]}`);
                            }}
                            className={cn('flex items-center gap-1 rounded-md border px-2 py-1 text-[11px] font-semibold transition', p.estado === e || (e === 'hallazgo' && estado === 'hallazgo' && p.estado === 'pendiente') ? TONO[e] : 'border-zinc-200 text-zinc-500 hover:border-zinc-400')}
                            title={p.estado === e ? 'Volver a pendiente' : ESTADOS_PUNTO[e]}
                          >
                            {e === 'conforme' ? <Check className="h-3 w-3" /> : e === 'hallazgo' ? <TriangleAlert className="h-3 w-3" /> : <Ban className="h-3 w-3" />}
                            <span className="hidden sm:inline">{e === 'no_aplica' ? 'N/A' : ESTADOS_PUNTO[e]}</span>
                          </button>
                        ))}
                        {puedeEditarEstructura && (
                          <button type="button" aria-label="Quitar punto del plan" title="Quitar punto del plan" className="p-1 text-zinc-400 hover:text-red-600" onClick={() => confirm('¿Quitar este punto del plan de esta auditoría?') && guardar((actual) => actual.filter((x) => x.id !== p.id), `punto quitado ${tituloCorto(p)}`)}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </>
                    ) : (
                      <span className={cn('rounded-md border px-2 py-1 text-[11px] font-semibold', TONO[estado])}>{ESTADOS_PUNTO[estado]}</span>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {editable && (
        agregando ? (
          <div className="flex flex-wrap gap-2">
            <Input className="min-w-60 flex-1" autoFocus value={nuevoTitulo} onChange={(e) => setNuevoTitulo(e.target.value)} placeholder="Nuevo punto a revisar (ej.: Registros de capacitación 2026)" />
            <Button variant="primary" disabled={nuevoTitulo.trim().length < 3} onClick={() => { const t = nuevoTitulo.trim(); void guardar((actual) => [...actual, { id: nuevoIdPunto(), titulo: t, grupo: 'operacion', requisitos: [], referencia: null, origen: 'manual', estado: 'pendiente', hallazgoIds: [], hallazgoOrigenId: null, revisadoPor: null }], `punto agregado «${t}»`, 'Punto agregado'); setNuevoTitulo(''); setAgregando(false); }}>Agregar</Button>
            <Button onClick={() => setAgregando(false)}>Cancelar</Button>
          </div>
        ) : (
          <button type="button" onClick={() => setAgregando(true)} className="flex items-center gap-1.5 text-xs font-semibold text-zinc-600 hover:text-zinc-900">
            <ListPlus className="h-4 w-4" /> Agregar punto a esta auditoría
          </button>
        )
      )}

      {fuera.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm">
          <p className="font-semibold text-amber-800">{fuera.length} hallazgo(s) fuera del plan</p>
          <p className="text-xs text-amber-800">No coinciden con ningún punto por cláusula ni procedimiento. Asócialos para que el informe muestre qué punto cubren.</p>
          <ul className="mt-2 space-y-1.5">
            {fuera.map((h) => (
              <li key={h.id} className="flex flex-wrap items-center gap-2">
                <button type="button" onClick={() => onIrHallazgo(h.id)} className={cn('rounded-full px-2 text-[11px] font-bold text-white', h.tipo === 'NC' ? 'bg-red-600' : 'bg-sky-600')}>#{h.correlativo}</button>
                <span className="min-w-0 flex-1 truncate text-xs text-zinc-700">{h.descripcion}</span>
                {editable && (
                  <Select
                    className="w-60 text-xs"
                    value=""
                    placeholder="Asociar a punto…"
                    options={plan.map((p) => ({ value: p.id, label: `${numero.get(p.id)}. ${p.titulo}`.slice(0, 70) }))}
                    onChange={(e) => {
                      const pid = e.target.value;
                      const punto = plan.find((x) => x.id === pid);
                      if (pid && punto) void cambiar(pid, (x) => ({ ...x, hallazgoIds: [...new Set([...x.hallazgoIds, h.id])], estado: 'hallazgo', revisadoPor: u.id }), `hallazgo #${h.correlativo} asociado a ${tituloCorto(punto)}`);
                    }}
                  />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
      {pdfAbierto && (
        <PlanPdfModal
          open
          onClose={() => setPdfAbierto(false)}
          liderId={a.auditorLiderId}
          equipoInicial={[a.auditorLiderId, ...a.equipoIds].filter((x, i, arr) => x && arr.indexOf(x) === i)}
          fechaInicial={a.fechaPlanificada ?? ''}
          base={{
            codigo: a.codigo, anio: a.anio, objetivos: a.objetivos, alcance: a.alcance,
            sucursal: mapa.sucursales[a.sucursalId]?.nombre ?? '', area: mapa.areas[a.areaId]?.nombre ?? '',
            auditados: a.auditadosTexto, normas: a.normas,
            puntos: plan.filter((p) => p.origen === 'plan' || p.origen === 'manual').map((p) => ({ titulo: p.titulo, grupo: '', requisitos: [], referencia: p.referencia })),
          }}
          alDescargar={(equipo, fecha) => void registrarDescargaPlanPdf(u, a, equipo, fecha).catch(() => undefined)}
        />
      )}
    </div>
  );
}
