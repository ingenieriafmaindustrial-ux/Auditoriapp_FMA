import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addMonths, format } from 'date-fns';
import { es } from 'date-fns/locale';
import { BellRing, CalendarCheck2, CalendarDays, CalendarPlus, ChevronLeft, ChevronRight, Copy, FileDown, FilterX, LayoutGrid } from 'lucide-react';
import { Button, Card, Spinner } from '../../components/ui';
import { BarraFiltros, Segmentado, SelectPildora } from '../../components/shared/Filtros';
import { useContar } from '../../components/charts/useAnimacion';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { esGestor } from '../../domain/permisos';
import { ESTADO_PROGRAMA, TIPO_PROGRAMA, asignadoA, construirEventos, indicadoresPrograma, type EstadoProgramado, type EventoAuditoria } from '../../domain/programa';
import { anioActual } from '../../lib/dates';
import { errorMensaje } from '../../lib/utils';
import { NORMAS } from '../../lib/constants';
import { copiarPrograma, vincularAuditoria, type ProgramaForm } from '../../services/programa';
import { AuditoriaFormModal } from '../auditorias/AuditoriaFormModal';
import { PlanPdfModal } from '../auditorias/hoja/PlanPdfModal';
import { ProgramaFormModal } from './ProgramaFormModal';
import { VistaPreviaModal } from './VistaPreviaModal';
import { ProgramaAnual } from './ProgramaAnual';
import { CalendarioMes } from './CalendarioMes';
import type { ProgramaItem, TipoProgramado } from '../../types';
import { ExportarProgramaModal } from './ExportarProgramaModal';
import { PlanEficaciaModal } from './PlanEficaciaModal';

type Modo = 'programa' | 'calendario';

function Indicador({ label, valor, sufijo = '', color, detalle }: { label: string; valor: number; sufijo?: string; color: string; detalle?: string }) {
  const v = useContar(valor);
  return (
    <div className="viz-entra flex flex-col rounded-xl bg-white/5 px-4 py-3 ring-1 ring-white/10">
      <span className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-zinc-400">
        <span className="h-2 w-2 rounded-full" style={{ background: color }} /> {label}
      </span>
      <span className="mt-1.5 font-[family-name:var(--font-display)] text-3xl font-bold leading-none text-white" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}{sufijo}</span>
      {detalle && <span className="mt-1 text-[11px] text-zinc-400">{detalle}</span>}
    </div>
  );
}

function Leyenda() {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
      {(Object.keys(ESTADO_PROGRAMA) as EstadoProgramado[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5"><span className="h-3 w-1 rounded-full" style={{ background: ESTADO_PROGRAMA[k].color }} /> {ESTADO_PROGRAMA[k].label}</li>
      ))}
      <li className="flex items-center gap-1.5"><span className="h-3 w-3 rounded ring-1 ring-brand" /> Te corresponde</li>
      {(Object.keys(TIPO_PROGRAMA) as TipoProgramado[]).map((k) => (
        <li key={k} className="flex items-center gap-1.5"><span className="flex h-4 w-4 items-center justify-center rounded bg-panel text-[9px] font-bold text-brand">{TIPO_PROGRAMA[k].letra}</span> {TIPO_PROGRAMA[k].label}</li>
      ))}
    </ul>
  );
}

export default function CalendarioPage() {
  const u = useUsuario();
  const notify = useToast();
  const { programa, auditorias, areas, sucursales, auditores, mapa, cargando } = useData();
  const gestor = esGestor(u.rol);
  const [params, setParams] = useSearchParams();

  const [modo, setModo] = useState<Modo>(params.get('modo') === 'programa' ? 'programa' : 'calendario');
  const [anio, setAnio] = useState(anioActual());
  const [mes, setMes] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [sucursal, setSucursal] = useState('');
  const [auditor, setAuditor] = useState(u.rol === 'auditor' && u.auditorId ? 'mios' : '');
  const [area, setArea] = useState('');
  const [estado, setEstado] = useState<EstadoProgramado | ''>('');
  const [tipo, setTipo] = useState<TipoProgramado | ''>('');
  const [exportar, setExportar] = useState(false);
  const [planEficacia, setPlanEficacia] = useState(false);
  const [verEneFeb, setVerEneFeb] = useState(false);

  const [preview, setPreview] = useState<EventoAuditoria | null>(null);
  const [form, setForm] = useState<{ item?: ProgramaItem | null; inicial?: Partial<ProgramaForm> } | null>(null);
  const [crear, setCrear] = useState<EventoAuditoria | null>(null);
  const [planDe, setPlanDe] = useState<EventoAuditoria | null>(null);
  const [copiando, setCopiando] = useState(false);

  const todos = useMemo(() => construirEventos(programa, auditorias), [programa, auditorias]);

  // Abrir la ficha desde un aviso de la campana: /calendario?ver=<id de evento>
  useEffect(() => {
    const ver = params.get('ver');
    if (!ver || !todos.length) return;
    const e = todos.find((x) => x.id === ver);
    if (e) {
      setPreview(e);
      setMes(new Date(Number(e.fecha.slice(0, 4)), Number(e.fecha.slice(5, 7)) - 1, 1));
      setAnio(Number(e.fecha.slice(0, 4)));
    }
    params.delete('ver');
    setParams(params, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos.length]);

  // Mantener la ficha abierta sincronizada con los cambios en vivo
  useEffect(() => {
    if (preview) setPreview(todos.find((x) => x.id === preview.id) ?? null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [todos]);

  const sucDe = (e: EventoAuditoria) => mapa.areas[e.areaId]?.sucursalId ?? e.sucursalId;
  const filtroBase = (e: EventoAuditoria) =>
    (!sucursal || sucDe(e) === sucursal) &&
    (!area || e.areaId === area) &&
    (!tipo || e.tipo === tipo) &&
    (!auditor || (auditor === 'mios' ? asignadoA(e, u) : e.liderId === auditor || e.equipoIds.includes(auditor)));
  const delAnio = todos.filter((e) => e.anio === anio && filtroBase(e));
  const visibles = (modo === 'calendario' ? todos.filter(filtroBase) : delAnio).filter((e) => !estado || e.estado === estado);

  const areasActivas = areas.filter((a) => a.activo && (!sucursal || a.sucursalId === sucursal) && (!area || a.id === area));
  const ind = indicadoresPrograma(delAnio, areasActivas.length);
  const anios = [...new Set([anioActual(), anioActual() + 1, ...todos.map((e) => e.anio)])].sort((a, b) => b - a);
  const hayFiltros = sucursal || area || auditor || estado || tipo;

  // Aviso del mes (lo que le toca al usuario en el mes visible)
  const mesClave = format(modo === 'calendario' ? mes : new Date(), 'yyyy-MM');
  const misDelMes = todos.filter((e) => e.fecha.slice(0, 7) === mesClave && e.estado !== 'cancelada' && e.estado !== 'realizada' && asignadoA(e, u));

  const grupos = [...sucursales.filter((s) => !sucursal || s.id === sucursal).map((s) => ({ sucursal: s, areas: areasActivas.filter((a) => a.sucursalId === s.id) })), ...(!sucursal ? [{ sucursal: null, areas: areasActivas.filter((a) => !a.sucursalId) }] : [])];

  const programaAnterior = programa.filter((p) => p.anio === anio - 1);
  const programaActual = programa.filter((p) => p.anio === anio);

  if (cargando) return <Spinner />;

  const cambiarMes = (n: number) => {
    const m = addMonths(mes, n);
    setMes(m);
    setAnio(m.getFullYear());
  };
  const limpiar = () => {
    setSucursal('');
    setArea('');
    setAuditor('');
    setEstado('');
    setTipo('');
  };
  const mesTxt = format(modo === 'calendario' ? mes : new Date(), "MMMM 'de' yyyy", { locale: es });
  const areaPdf = planDe ? mapa.areas[planDe.areaId] : null;

  const toolbar: ReactNode = (
    <BarraFiltros activos={[sucursal, area, auditor, estado, tipo].filter(Boolean).length}>
      <SelectPildora etiqueta="Año" ancho="w-32" valor={String(anio)} onChange={(v) => { setAnio(Number(v)); setMes(new Date(Number(v), mes.getMonth(), 1)); }} opciones={anios.map((y) => ({ v: String(y), label: `Año ${y}` }))} />
      <Segmentado etiqueta="Sucursal" valor={sucursal} onChange={(v) => { setSucursal(v); setArea(''); }} opciones={[{ v: '', label: 'Todas' }, ...sucursales.map((s) => ({ v: s.id, label: s.nombre }))]} />
      <SelectPildora etiqueta="Auditor" ancho="w-48 truncate" valor={auditor} onChange={setAuditor} opciones={[{ v: '', label: 'Todos los auditores' }, ...(u.auditorId ? [{ v: 'mios', label: 'Mis auditorías' }] : []), ...auditores.filter((a) => a.activo).map((a) => ({ v: a.id, label: a.nombre }))]} />
      <SelectPildora etiqueta="Área" ancho="w-48 truncate" valor={area} onChange={setArea} opciones={[{ v: '', label: 'Todas las áreas' }, ...areas.filter((a) => a.activo && (!sucursal || a.sucursalId === sucursal)).map((a) => ({ v: a.id, label: `${a.nombre}${a.sucursalId && !sucursal ? ` · ${mapa.sucursales[a.sucursalId]?.nombre ?? ''}` : ''}` }))]} />
      <SelectPildora etiqueta="Actividad" ancho="w-40" valor={tipo} onChange={(v) => setTipo(v as TipoProgramado | '')} opciones={[{ v: '', label: 'Todas las actividades' }, ...(Object.keys(TIPO_PROGRAMA) as TipoProgramado[]).map((k) => ({ v: k, label: TIPO_PROGRAMA[k].label }))]} />
      <SelectPildora etiqueta="Estado" ancho="w-40" valor={estado} onChange={(v) => setEstado(v as EstadoProgramado | '')} opciones={[{ v: '', label: 'Todos los estados' }, ...(Object.keys(ESTADO_PROGRAMA) as EstadoProgramado[]).map((k) => ({ v: k, label: ESTADO_PROGRAMA[k].label }))]} />
      {hayFiltros && (
        <button type="button" onClick={limpiar} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
          <FilterX className="h-3.5 w-3.5" /> Limpiar
        </button>
      )}
    </BarraFiltros>
  );

  return (
    <div className="space-y-5">
      {toolbar}

      {/* Encabezado + modalidad */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Programa de auditorías internas · {anio}</p>
          <h1 className="text-2xl font-bold uppercase text-zinc-900">Calendario</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Segmentado
            etiqueta="Modalidad"
            valor={modo}
            onChange={setModo}
            opciones={[
              { v: 'calendario' as Modo, label: <><CalendarDays className="h-3.5 w-3.5" /> Calendario</> },
              { v: 'programa' as Modo, label: <><LayoutGrid className="h-3.5 w-3.5" /> Programa anual</> },
            ]}
          />
          <Button icon={<FileDown className="h-4 w-4" />} onClick={() => setExportar(true)} title="Programa anual en PDF para enviar">Exportar PDF</Button>
          {gestor && <Button icon={<CalendarCheck2 className="h-4 w-4" />} onClick={() => setPlanEficacia(true)} title="Genera las revisiones de eficacia de noviembre y diciembre">Programar eficacia</Button>}
          {gestor && <Button variant="primary" icon={<CalendarPlus className="h-4 w-4" />} onClick={() => setForm({ inicial: { sucursalId: sucursal, areaId: area, tipo: tipo || 'auditoria' } })}>Programar</Button>}
        </div>
      </div>

      {/* Banner de indicadores */}
      <section className="relative overflow-hidden rounded-2xl bg-band p-4 text-white sm:p-5" aria-label="Indicadores del programa">
        <span className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-brand/10 blur-2xl" />
        <div className="relative grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
          <Indicador label="Programadas" valor={ind.total} color="var(--viz-om)" detalle={`${delAnio.filter((e) => e.tipo === 'auditoria' && e.estado !== 'cancelada').length} aud. · ${delAnio.filter((e) => e.tipo === 'seguimiento' && e.estado !== 'cancelada').length} seg. · ${delAnio.filter((e) => e.tipo === 'eficacia' && e.estado !== 'cancelada').length} efic.`} />
          <Indicador label="Realizadas" valor={ind.realizadas} color="var(--viz-good)" detalle={`${ind.avance}% de avance`} />
          <Indicador label="En curso" valor={ind.enCurso} color="var(--viz-warning)" />
          <Indicador label="Próximos 30 días" valor={ind.proximas30} color="var(--color-brand)" />
          <Indicador label="Atrasadas" valor={ind.atrasadas} color="var(--viz-critical)" detalle={ind.atrasadas ? 'requieren reprogramar' : 'al día'} />
          <Indicador label="Cobertura de áreas" valor={ind.cobertura} sufijo="%" color="#a78bfa" detalle={`${areasActivas.length} áreas activas`} />
        </div>
        <div className="relative mt-4">
          <div className="flex justify-between text-[11px] font-semibold uppercase tracking-wider text-zinc-400"><span>Avance del programa {anio}</span><span>{ind.avance}%</span></div>
          <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-white/10">
            <div key={ind.avance} className="viz-fila h-full rounded-full bg-brand" style={{ width: `${ind.avance}%` }} />
          </div>
        </div>
      </section>

      {/* Aviso del mes */}
      {misDelMes.length > 0 && (
        <section className="viz-entra flex flex-wrap items-center gap-4 rounded-2xl border border-brand/60 bg-panel px-4 py-3 text-white shadow-[0_0_0_4px_rgb(245_196_0/0.10)]" aria-live="polite">
          <span className="alerta-parpadeo flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand"><BellRing className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-[family-name:var(--font-display)] text-lg font-bold uppercase leading-tight">
              En {mesTxt} tienes {misDelMes.length} {misDelMes.length === 1 ? 'auditoría asignada' : 'auditorías asignadas'}
            </p>
            <p className="truncate text-sm text-zinc-300">{misDelMes.map((e) => `${mapa.areas[e.areaId]?.nombre ?? 'Área'} (${e.fecha.slice(8, 10)})`).join(' · ')}</p>
          </div>
          <Button variant="primary" onClick={() => { setAuditor('mios'); setModo('calendario'); }}>Revisar</Button>
        </section>
      )}

      {modo === 'calendario' ? (
        <Card
          title={
            <span className="flex items-center gap-2">
              <button type="button" onClick={() => cambiarMes(-1)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-zinc-100" aria-label="Mes anterior"><ChevronLeft className="h-5 w-5" /></button>
              <span className="min-w-[10rem] text-center text-base font-bold capitalize text-zinc-900">{format(mes, "MMMM yyyy", { locale: es })}</span>
              <button type="button" onClick={() => cambiarMes(1)} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full hover:bg-zinc-100" aria-label="Mes siguiente"><ChevronRight className="h-5 w-5" /></button>
              <button type="button" onClick={() => { const h = new Date(); setMes(new Date(h.getFullYear(), h.getMonth(), 1)); setAnio(h.getFullYear()); }} className="ml-1 h-9 cursor-pointer rounded-full border border-zinc-300 px-3 text-xs font-semibold text-zinc-700 hover:bg-zinc-50">Hoy</button>
            </span>
          }
          actions={<div className="hidden lg:block"><Leyenda /></div>}
        >
          <CalendarioMes
            mes={mes}
            eventos={visibles}
            areas={mapa.areas}
            auditores={mapa.auditores}
            u={u}
            puedeProgramar={gestor}
            onSelect={setPreview}
            onProgramarDia={(fecha) => setForm({ inicial: { fecha, sucursalId: sucursal, areaId: area, tipo: tipo || 'auditoria' } })}
          />
          <div className="mt-3 lg:hidden"><Leyenda /></div>
        </Card>
      ) : (
        <Card
          title={`Programa anual ${anio}`}
          actions={
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex cursor-pointer items-center gap-2 text-xs text-zinc-600"><input type="checkbox" checked={verEneFeb} onChange={(e) => setVerEneFeb(e.target.checked)} /> Mostrar enero y febrero</label>
              {gestor && programaActual.length === 0 && programaAnterior.length > 0 && (
                <Button
                  size="sm"
                  icon={<Copy className="h-3.5 w-3.5" />}
                  loading={copiando}
                  onClick={async () => {
                    setCopiando(true);
                    try {
                      await copiarPrograma(u, programaAnterior, anio);
                      notify(`Programa ${anio - 1} copiado a ${anio}: revisa fechas y equipos`);
                    } catch (e) {
                      notify(errorMensaje(e), 'error');
                    } finally {
                      setCopiando(false);
                    }
                  }}
                >
                  Copiar programa {anio - 1}
                </Button>
              )}
            </div>
          }
        >
          <ProgramaAnual
            anio={anio}
            grupos={grupos}
            eventos={visibles}
            auditores={mapa.auditores}
            u={u}
            puedeProgramar={gestor}
            verEneFeb={verEneFeb}
            onSelect={setPreview}
            onProgramar={(areaId, sucursalId, m) => setForm({ inicial: { areaId, sucursalId, tipo: tipo || 'auditoria', fecha: `${anio}-${String(m + 1).padStart(2, '0')}-15` } })}
          />
          <div className="mt-4 border-t border-zinc-100 pt-3"><Leyenda /></div>
        </Card>
      )}

      <VistaPreviaModal
        evento={preview}
        onClose={() => setPreview(null)}
        onEditar={(e) => { setPreview(null); setForm({ item: e.programa }); }}
        onCrear={(e) => { setPreview(null); setCrear(e); }}
        onPlanPdf={(e) => setPlanDe(e)}
      />
      <ExportarProgramaModal
        open={exportar}
        onClose={() => setExportar(false)}
        anio={anio}
        eventos={delAnio}
        grupos={grupos}
        alcanceTxt={sucursal ? mapa.sucursales[sucursal]?.nombre ?? 'Sucursal' : 'Todas las sucursales'}
      />
      <PlanEficaciaModal open={planEficacia} onClose={() => setPlanEficacia(false)} anio={anio} />
      <ProgramaFormModal open={!!form} onClose={() => setForm(null)} item={form?.item} inicial={form?.inicial} />
      {crear && (
        <AuditoriaFormModal
          open
          onClose={() => setCrear(null)}
          anioInicial={crear.anio}
          prefill={{ anio: crear.anio, sucursalId: crear.sucursalId, areaId: crear.areaId, auditorLiderId: crear.liderId, equipoIds: crear.equipoIds, fechaPlanificada: crear.fecha }}
          onCreada={async (id) => {
            if (crear.programa) {
              try {
                await vincularAuditoria(crear.programa, id);
              } catch (e) {
                notify(errorMensaje(e), 'error');
              }
            }
            setCrear(null);
          }}
        />
      )}
      {planDe && areaPdf && (
        <PlanPdfModal
          open
          onClose={() => setPlanDe(null)}
          liderId={planDe.liderId}
          equipoInicial={[planDe.liderId, ...planDe.equipoIds].filter(Boolean)}
          fechaInicial={planDe.fecha}
          base={{
            codigo: planDe.auditoria?.codigo ?? '',
            anio: planDe.anio,
            objetivos: 'Verificar el cumplimiento de los requisitos del sistema de gestión integrado en el área, de acuerdo con los puntos del plan de auditoría.',
            alcance: `Procesos del área ${areaPdf.nombre}${mapa.sucursales[planDe.sucursalId] ? ` · ${mapa.sucursales[planDe.sucursalId].nombre}` : ''}.`,
            sucursal: mapa.sucursales[planDe.sucursalId]?.nombre ?? '',
            area: areaPdf.nombre,
            auditados: [areaPdf.encargado, areaPdf.cargoEncargado].filter(Boolean).join(' · '),
            normas: NORMAS,
            puntos: (areaPdf.plan ?? []).map((p) => ({ titulo: p.titulo, grupo: '', requisitos: [], referencia: p.referencia })),
          }}
        />
      )}
    </div>
  );
}
