import { useMemo, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, BellRing, CalendarClock, CheckCircle2, ChevronRight, ClipboardList, FileSpreadsheet, FileText, FilterX, Layers, MapPin, MessageSquareWarning } from 'lucide-react';
import { EvolucionAnual, type ConteoTipo } from '../components/charts/EvolucionAnual';
import { Versus } from '../components/charts/Versus';
import { usePendientes } from '../hooks/usePendientes';
import { Button, Card, EmptyState, Spinner } from '../components/ui';
import { useToast } from '../context/ToastContext';
import { errorMensaje } from '../lib/utils';
import { exportarPanelExcel } from '../services/exportarPanel';
import { EstadoAuditoriaBadge, EstadoHallazgoBadge, NivelBadge, PlazoBadge, TipoBadge } from '../components/shared/Badges';
import { ColumnasApiladas } from '../components/charts/ColumnasApiladas';
import { iconosEstado } from '../components/charts/BarraEstado';
import { Dona } from '../components/charts/Dona';
import { BarrasProgreso } from '../components/charts/BarrasProgreso';
import { useContar } from '../components/charts/useAnimacion';
import { BarraFiltros, Segmentado, SelectPildora } from '../components/shared/Filtros';
import { TIPO_PROGRAMA, asignadoA, construirEventos } from '../domain/programa';
import { InformeAnualModal } from './informes/InformeAnualModal';
import { useData } from '../context/DataContext';
import { useUsuario } from '../context/AuthContext';
import { semaforoPlazo } from '../domain/hallazgoReglas';
import { aniosDisponibles, anioActual, ANIO_INICIO, diasHasta, fmtFecha } from '../lib/dates';
import type { EstadoHallazgo, Hallazgo, TipoHallazgo } from '../types';

const MESES = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
/** Período de auditorías: marzo a diciembre (enero y febrero quedan fuera del gráfico mensual). */
const MES_INICIO = 2;

/** Indicador: cifra con conteo animado, ícono con acento y barra de proporción. */
function Kpi({ label, valor, sufijo = '', detalle, icon, acento, progreso }: { label: string; valor: number; sufijo?: string; detalle: string; icon: ReactNode; acento: string; progreso: number }) {
  const v = useContar(valor);
  return (
    <div className="card viz-entra flex h-full flex-col p-5">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">{label}</p>
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg" style={{ background: `color-mix(in srgb, ${acento} 16%, transparent)`, color: acento }}>{icon}</span>
      </div>
      <p className="mt-2 font-[family-name:var(--font-display)] text-4xl font-bold leading-none text-zinc-900" style={{ fontVariantNumeric: 'tabular-nums' }}>{v}{sufijo}</p>
      <div className="mt-auto pt-4">
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-100">
          <div key={Math.round(progreso)} className="viz-fila h-full rounded-full" style={{ width: `${Math.min(100, Math.max(0, progreso))}%`, background: acento }} />
        </div>
        <p className="mt-2 truncate text-xs text-zinc-500">{detalle}</p>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const u = useUsuario();
  const { auditorias, hallazgos, areas, sucursales, mapa, programa, cargando } = useData();
  const notify = useToast();
  const [exportando, setExportando] = useState(false);
  const [informe, setInforme] = useState(false);
  const [anio, setAnio] = useState<number | null>(anioActual());
  const [sucursal, setSucursal] = useState('');
  const [area, setArea] = useState('');
  const [tipo, setTipo] = useState<TipoHallazgo | ''>('');
  const [estado, setEstado] = useState<EstadoHallazgo | ''>('');

  const pend = usePendientes();
  const anios = aniosDisponibles([...auditorias.map((a) => a.anio), ...hallazgos.map((h) => h.anio)]);
  const hayFiltros = anio !== anioActual() || sucursal || area || tipo || estado;

  // Una misma área puede existir en Santiago y Antofagasta: son registros distintos.
  const sucDe = (h: Hallazgo) => mapa.areas[h.areaId]?.sucursalId ?? h.sucursalId;
  const nombreArea = (id: string) => {
    const ar = mapa.areas[id];
    if (!ar) return 'Área sin catálogo';
    const suc = ar.sucursalId ? mapa.sucursales[ar.sucursalId]?.nombre : '';
    return sucursal || !suc ? ar.nombre : `${ar.nombre} · ${suc}`;
  };
  const areasVisibles = areas.filter((a) => !sucursal || a.sucursalId === sucursal).sort((a, b) => nombreArea(a.id).localeCompare(nombreArea(b.id)));

  const d = useMemo(() => {
    const enSuc = (h: Hallazgo) => !sucursal || sucDe(h) === sucursal;
    const base = hallazgos.filter((h) => !h.anulado && enSuc(h) && (anio === null || h.anio === anio) && (!area || h.areaId === area));
    // Cada gráfico excluye su propio filtro para seguir mostrando el contexto (filtro cruzado)
    const porTipo = base.filter((h) => !tipo || h.tipo === tipo);
    const hs = porTipo.filter((h) => !estado || h.estado === estado);
    const auds = auditorias.filter((a) => a.estado !== 'anulada' && (!sucursal || a.sucursalId === sucursal) && (anio === null || a.anio === anio) && (!area || a.areaId === area));

    const temporal =
      anio === null
        ? Array.from({ length: Math.max(anioActual(), ...hs.map((h) => h.anio)) - ANIO_INICIO + 1 }, (_, i) => ANIO_INICIO + i).map((y) => {
            const del = hs.filter((h) => h.anio === y);
            return { label: String(y), valores: { NC: del.filter((h) => h.tipo === 'NC').length, OM: del.filter((h) => h.tipo === 'OM').length } };
          })
        : MESES.map((mes, i) => ({ mes, i }))
            .filter(({ i }) => i >= MES_INICIO)
            .map(({ mes, i }) => {
              const del = hs.filter((h) => Number(h.fechaDeteccion?.slice(5, 7)) === i + 1);
              return { label: mes, valores: { NC: del.filter((h) => h.tipo === 'NC').length, OM: del.filter((h) => h.tipo === 'OM').length } };
            });
    const fueraPeriodo = anio === null ? 0 : hs.filter((h) => Number(h.fechaDeteccion?.slice(5, 7)) <= MES_INICIO).length;

    const estados = (['no_tratada', 'en_seguimiento', 'tratada'] as EstadoHallazgo[]).map((e) => porTipo.filter((h) => h.estado === e).length);
    const baseSinArea = hallazgos.filter((h) => !h.anulado && (anio === null || h.anio === anio) && (!tipo || h.tipo === tipo) && (!estado || h.estado === estado));
    // Por área, separado por sucursal (columnas NC/OM como el gráfico mensual). Ignora el filtro de área para dar contexto.
    const porAreaSucursal = [
      ...sucursales.filter((s) => !sucursal || s.id === sucursal).map((s) => ({ id: s.id, nombre: s.nombre })),
      ...(areas.some((a) => !a.sucursalId) && !sucursal ? [{ id: '', nombre: 'Sin sucursal' }] : []),
    ]
      .map((s) => ({
        ...s,
        areas: areas
          .filter((a) => (a.sucursalId ?? '') === s.id && (a.activo || baseSinArea.some((h) => h.areaId === a.id)))
          .map((a) => {
            const del = baseSinArea.filter((h) => h.areaId === a.id);
            return { id: a.id, label: a.nombre, titulo: `${a.nombre}${s.nombre ? ' · ' + s.nombre : ''}`, valores: { NC: del.filter((h) => h.tipo === 'NC').length, OM: del.filter((h) => h.tipo === 'OM').length } };
          })
          .sort((x, y) => y.valores.NC + y.valores.OM - (x.valores.NC + x.valores.OM) || x.label.localeCompare(y.label)),
      }))
      .filter((s) => s.areas.length);
    // Por sucursal: ignora su propio filtro (y el de área) para comparar ambas sedes
    const porSucursal = sucursales.map((s) => {
      const del = baseSinArea.filter((h) => sucDe(h) === s.id);
      return { id: s.id, label: s.nombre, nc: del.filter((h) => h.tipo === 'NC').length, om: del.filter((h) => h.tipo === 'OM').length, abiertos: del.filter((h) => h.estado !== 'tratada').length, valor: del.length };
    });
    const nivel = (['BAJA', 'MEDIA', 'ALTA'] as const).map((n) => ({ key: n, label: n.charAt(0) + n.slice(1).toLowerCase(), valor: hs.filter((h) => h.nivel === n).length }));
    const nTipo = { NC: porTipo.filter((h) => h.tipo === 'NC').length, OM: porTipo.filter((h) => h.tipo === 'OM').length };

    const aniosComp = Array.from({ length: Math.max(anioActual(), ...hallazgos.map((h) => h.anio)) - ANIO_INICIO + 1 }, (_, i) => ANIO_INICIO + i).slice(-4);
    // Evolución anual: respeta sucursal, área, tipo y estado (no el año: compara todos los años)
    const baseComp = hallazgos.filter((h) => !h.anulado && (!sucursal || sucDe(h) === sucursal) && (!area || h.areaId === area) && (!estado || h.estado === estado));
    const conteo = (l: Hallazgo[]): ConteoTipo => ({ nc: l.filter((h) => h.tipo === 'NC').length, om: l.filter((h) => h.tipo === 'OM').length });
    const resumenAnual = Object.fromEntries(aniosComp.map((y) => [y, conteo(baseComp.filter((h) => h.anio === y))])) as Record<number, ConteoTipo>;
    const evolucion = areasVisibles
      .filter((ar) => !area || ar.id === area)
      .map((ar) => ({
        id: ar.id,
        label: ar.nombre,
        sub: ar.sucursalId ? mapa.sucursales[ar.sucursalId]?.nombre : undefined,
        porAnio: Object.fromEntries(aniosComp.map((y) => [y, conteo(baseComp.filter((h) => h.areaId === ar.id && h.anio === y))])) as Record<number, ConteoTipo>,
      }));

    // Santiago vs Antofagasta (ignora el filtro de sucursal y de área)
    const [sa, sb] = sucursales;
    const metricas = (sid: string | undefined) => {
      const del = sid ? baseSinArea.filter((h) => sucDe(h) === sid) : [];
      const audsS = sid ? auditorias.filter((a) => a.estado !== 'anulada' && a.sucursalId === sid && (anio === null || a.anio === anio)).length : 0;
      const trat = del.filter((h) => h.estado === 'tratada').length;
      return { auds: audsS, total: del.length, nc: del.filter((h) => h.tipo === 'NC').length, om: del.filter((h) => h.tipo === 'OM').length, pend: del.length - trat, pct: del.length ? Math.round((trat / del.length) * 100) : 0 };
    };
    const ma = metricas(sa?.id);
    const mb = metricas(sb?.id);
    const versus = sa && sb
      ? {
          a: sa.nombre,
          b: sb.nombre,
          filas: [
            { label: 'Auditorías', a: ma.auds, b: mb.auds },
            { label: 'Hallazgos', a: ma.total, b: mb.total },
            { label: 'No conformidades', a: ma.nc, b: mb.nc },
            { label: 'Oport. de mejora', a: ma.om, b: mb.om },
            { label: 'Pendientes', a: ma.pend, b: mb.pend },
            { label: '% tratados', a: ma.pct, b: mb.pct, sufijo: '%' },
          ],
        }
      : null;

    // Hallazgos por norma ISO (un hallazgo puede tocar varias normas)
    const porNorma = (['ISO 9001', 'ISO 14001', 'ISO 45001'] as const).map((n) => ({ key: n, label: n, valor: hs.filter((h) => h.normas?.includes(n)).length }));

    const abiertos = hallazgos.filter((h) => !h.anulado && enSuc(h) && h.tipo === 'NC' && h.estado !== 'tratada' && (!area || h.areaId === area) && (!tipo || h.tipo === tipo));
    return {
      aniosComp,
      resumenAnual,
      evolucion,
      versus,
      porNorma,
      hs,
      auds,
      temporal,
      fueraPeriodo,
      estados,
      porAreaSucursal,
      porSucursal,
      nivel,
      nTipo,
      ncPend: porTipo.filter((h) => h.tipo === 'NC' && h.estado !== 'tratada').length,
      omPend: porTipo.filter((h) => h.tipo === 'OM' && h.estado !== 'tratada').length,
      pctTratados: porTipo.length ? Math.round((estados[2] / porTipo.length) * 100) : 0,
      totalTipo: porTipo.length,
      alertas: [...abiertos.filter((h) => semaforoPlazo(h) === 'vencido'), ...abiertos.filter((h) => semaforoPlazo(h) === 'proximo')],
      // Agenda: programa anual (auditorías, seguimientos y mediciones de eficacia) + auditorías planificadas
      proximas: construirEventos(programa, auditorias)
        .filter((e) => e.estado !== 'cancelada' && e.estado !== 'realizada' && e.estado !== 'en_curso' && (!sucursal || e.sucursalId === sucursal) && (!area || e.areaId === area) && diasHasta(e.fecha) >= 0 && diasHasta(e.fecha) <= 30)
        .sort((a, b) => a.fecha.localeCompare(b.fecha)),
    };
  }, [hallazgos, auditorias, programa, areas, sucursales, anio, sucursal, area, tipo, estado, mapa]);

  if (cargando) return <Spinner />;

  const periodo = (anio === null ? `${ANIO_INICIO}–${anioActual()}` : String(anio)) + (sucursal ? ` · ${mapa.sucursales[sucursal]?.nombre}` : ' · Todas las sucursales');
  const cambiarSucursal = (id: string) => {
    setSucursal(id);
    if (id && area && mapa.areas[area]?.sucursalId !== id) setArea('');
  };
  const limpiar = () => {
    setAnio(anioActual());
    setSucursal('');
    setArea('');
    setTipo('');
    setEstado('');
  };

  const seriesTipo = [
    ...(tipo !== 'OM' ? [{ key: 'NC', label: 'No conformidad', color: 'var(--viz-nc)' }] : []),
    ...(tipo !== 'NC' ? [{ key: 'OM', label: 'Oportunidad de mejora', color: 'var(--viz-om)' }] : []),
  ];
  const mesHoy = new Date().toISOString().slice(0, 7);
  const misDelMes = construirEventos(programa, auditorias).filter((e) => e.fecha.slice(0, 7) === mesHoy && e.estado !== 'cancelada' && e.estado !== 'realizada' && asignadoA(e, u));
  const enCurso = d.auds.filter((a) => a.estado === 'en_ejecucion' || a.estado === 'en_revision');
  const cerradas = d.auds.filter((a) => a.estado === 'cerrada').length;
  const exportar = async () => {
    setExportando(true);
    try {
      await exportarPanelExcel({ auditorias, hallazgos, sucursales, areas, mapa, usuario: u.nombre, anioInicio: ANIO_INICIO, filtros: { anio, sucursalId: sucursal, areaId: area, tipo, estado } });
      notify('Reporte Excel descargado');
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setExportando(false);
    }
  };
  const vacio = (txt: string) => <p className="flex h-full items-center justify-center py-12 text-center text-sm text-zinc-500">{txt}</p>;

  return (
    <div className="space-y-6">
      <InformeAnualModal open={informe} onClose={() => setInforme(false)} anioInicial={anio} sucursalInicial={sucursal} />
      {/* ---------- Filtros (nivel superior, una línea) ---------- */}
      <BarraFiltros
        activos={[anio !== anioActual(), sucursal, area, tipo, estado].filter(Boolean).length}
        extra={
          <>
            <Button variant="dark" icon={<FileText className="h-4 w-4 text-brand" />} onClick={() => setInforme(true)} title="Informe anual en PDF con gráficos para la revisión por la dirección">
              Informe
            </Button>
            <Button variant="dark" icon={<FileSpreadsheet className="h-4 w-4 text-brand" />} loading={exportando} onClick={exportar} title="Descarga una planilla Excel con los indicadores según los filtros activos">
              Exportar
            </Button>
          </>
        }
      >
        <SelectPildora
          etiqueta="Año"
          ancho="w-32"
          valor={anio === null ? 'todos' : String(anio)}
          onChange={(v) => setAnio(v === 'todos' ? null : Number(v))}
          opciones={[{ v: 'todos', label: 'Todos los años' }, ...anios.map((y) => ({ v: String(y), label: `Año ${y}` }))]}
        />
        <Segmentado etiqueta="Sucursal" valor={sucursal} onChange={cambiarSucursal} opciones={[{ v: '', label: 'Todas' }, ...sucursales.map((s) => ({ v: s.id, label: s.nombre }))]} />
        <SelectPildora etiqueta="Área" ancho="w-48 truncate" valor={area} onChange={setArea} opciones={[{ v: '', label: 'Todas las áreas' }, ...areasVisibles.map((a) => ({ v: a.id, label: nombreArea(a.id) }))]} />
        <Segmentado
          etiqueta="Tipo de hallazgo"
          valor={tipo}
          onChange={setTipo}
          opciones={[
            { v: '', label: 'Todos' },
            { v: 'NC', label: <><span className="chip-dot" style={{ background: 'var(--viz-nc)' }} /> NC</> },
            { v: 'OM', label: <><span className="chip-dot" style={{ background: 'var(--viz-om)' }} /> OM</> },
          ]}
        />
        <SelectPildora
          etiqueta="Estado de tratamiento"
          ancho="w-40"
          valor={estado}
          onChange={(v) => setEstado(v as EstadoHallazgo | '')}
          opciones={[{ v: '', label: 'Todos los estados' }, { v: 'no_tratada', label: 'No tratada' }, { v: 'en_seguimiento', label: 'En seguimiento' }, { v: 'tratada', label: 'Tratada' }]}
        />
        {hayFiltros && (
          <button type="button" onClick={limpiar} className="flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-semibold text-zinc-600 transition-colors hover:bg-zinc-100 hover:text-zinc-900">
            <FilterX className="h-3.5 w-3.5" /> Limpiar
          </button>
        )}
      </BarraFiltros>

      {/* ---------- Auditorías del mes asignadas al usuario ---------- */}
      {misDelMes.length > 0 && (
        <Link to="/calendario" className="viz-entra group flex flex-wrap items-center gap-4 rounded-2xl border border-brand/60 bg-panel px-4 py-3 text-white shadow-[0_0_0_4px_rgb(245_196_0/0.10)] transition-colors hover:border-brand">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand"><CalendarClock className="h-5 w-5" /></span>
          <span className="min-w-0 flex-1">
            <b className="block font-[family-name:var(--font-display)] text-lg uppercase leading-tight">Este mes tienes {misDelMes.length} {misDelMes.length === 1 ? 'auditoría asignada' : 'auditorías asignadas'}</b>
            <span className="block truncate text-sm text-zinc-300">{misDelMes.map((e) => `${mapa.areas[e.areaId]?.nombre ?? 'Área'} (${fmtFecha(e.fecha)})`).join(' · ')}</span>
          </span>
          <span className="flex items-center gap-1 text-sm font-semibold text-brand">Revisar <ChevronRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
        </Link>
      )}

      {/* ---------- Recordatorios destacados ---------- */}
      {(pend.revisiones.length > 0 || pend.observaciones.length > 0) && (
        <section className="relative overflow-hidden rounded-2xl border border-brand/60 bg-panel p-4 text-white shadow-[0_0_0_4px_rgb(245_196_0/0.12)] sm:p-5" aria-live="polite">
          <span className="pointer-events-none absolute inset-y-0 left-0 w-1.5 bg-brand" />
          <div className="flex flex-wrap items-start gap-4">
            <span className="alerta-parpadeo flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-brand/20 text-brand">
              <BellRing className="h-6 w-6" />
            </span>
            <div className="min-w-0 flex-1">
              {pend.revisiones.length > 0 && (
                <p className="font-[family-name:var(--font-display)] text-2xl font-bold uppercase leading-tight">
                  Tienes {pend.revisiones.length} {pend.revisiones.length === 1 ? 'informe' : 'informes'} sin aprobar
                </p>
              )}
              {pend.observaciones.length > 0 && (
                <p className="font-[family-name:var(--font-display)] text-xl font-bold uppercase leading-tight text-sky-300">
                  {pend.observaciones.length} {pend.observaciones.length === 1 ? 'auditoría devuelta' : 'auditorías devueltas'} con observaciones
                </p>
              )}
              <ul className="mt-2 grid gap-1.5 sm:grid-cols-2">
                {[...pend.revisiones, ...pend.observaciones].map((i) => (
                  <li key={i.id}>
                    <Link to={i.to} className="group flex items-center gap-2 rounded-lg bg-white/5 px-3 py-2 text-sm hover:bg-white/10">
                      {i.tipo === 'revision' ? <ClipboardList className="h-4 w-4 text-brand" /> : <MessageSquareWarning className="h-4 w-4 text-sky-300" />}
                      <span className="min-w-0 flex-1">
                        <b className="block truncate">{i.titulo}</b>
                        <span className="block truncate text-xs text-zinc-400">{i.detalle}</span>
                      </span>
                      <ChevronRight className="h-4 w-4 text-zinc-400 transition group-hover:translate-x-0.5" />
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      )}

      {/* ---------- Encabezado + indicadores ---------- */}
      <div>
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-bold uppercase text-zinc-900">Hola, {u.nombre.split(' ')[0]}</h1>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">Resumen · {periodo}</p>
        </div>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <Kpi label="Auditorías" valor={d.auds.length} progreso={d.auds.length ? (cerradas / d.auds.length) * 100 : 0} detalle={`${cerradas} cerradas · ${d.auds.filter((a) => a.estado === 'planificada').length} planificadas`} icon={<ClipboardList className="h-4.5 w-4.5" />} acento="var(--color-brand)" />
          <Kpi label="NC pendientes" valor={d.ncPend} progreso={d.nTipo.NC ? (d.ncPend / d.nTipo.NC) * 100 : 0} detalle={`de ${d.nTipo.NC} no conformidades`} icon={<AlertTriangle className="h-4.5 w-4.5" />} acento="var(--viz-nc)" />
          <Kpi label="OM pendientes" valor={d.omPend} progreso={d.nTipo.OM ? (d.omPend / d.nTipo.OM) * 100 : 0} detalle={`de ${d.nTipo.OM} oportunidades de mejora`} icon={<Layers className="h-4.5 w-4.5" />} acento="var(--viz-om)" />
          <Kpi label="Hallazgos tratados" valor={d.pctTratados} sufijo="%" progreso={d.pctTratados} detalle={`${d.estados[2]} de ${d.totalTipo} con tratamiento cerrado`} icon={<CheckCircle2 className="h-4.5 w-4.5" />} acento="var(--viz-good)" />
        </div>
      </div>

      {/* ---------- Fila 1: evolución + estado ---------- */}
      <div className="grid items-stretch gap-4 xl:grid-cols-3">
        <Card className="flex flex-col xl:col-span-2" title={anio === null ? 'Hallazgos por año' : `Hallazgos por mes · ${anio}`} actions={anio !== null && <span className="text-xs text-zinc-500">Marzo a diciembre</span>}>
          {d.hs.length === 0 ? vacio('Sin hallazgos para los filtros seleccionados.') : (
            <>
              <ColumnasApiladas datos={d.temporal} alto={260} series={seriesTipo} />
              {d.fueraPeriodo > 0 && <p className="mt-2 text-xs text-zinc-500">{d.fueraPeriodo} hallazgo(s) de enero o febrero no se grafican (fuera del período de auditorías).</p>}
            </>
          )}
        </Card>
        <Card className="flex flex-col" title="Estado de tratamiento" actions={<span className="text-xs text-zinc-500">Clic para filtrar</span>}>
          <div className="flex h-full items-center">
            <Dona
              vertical
              tamano={170}
              aria="Hallazgos por estado de tratamiento"
              centroValor={`${d.pctTratados}%`}
              centroLabel="tratados"
              seleccionado={estado || undefined}
              onSelect={(k) => setEstado(estado === k ? '' : (k as EstadoHallazgo))}
              segmentos={[
                { key: 'no_tratada', label: 'No tratada', valor: d.estados[0], color: 'var(--viz-critical)', icon: iconosEstado.no_tratada },
                { key: 'en_seguimiento', label: 'En seguimiento', valor: d.estados[1], color: 'var(--viz-warning)', icon: iconosEstado.en_seguimiento },
                { key: 'tratada', label: 'Tratada', valor: d.estados[2], color: 'var(--viz-good)', icon: iconosEstado.tratada },
              ]}
            />
          </div>
        </Card>
      </div>

      {/* ---------- Fila 2: composición (3 tarjetas iguales) ---------- */}
      <div className="grid items-stretch gap-4 md:grid-cols-2 xl:grid-cols-3">
        <Card className="flex flex-col" title="NC vs OM" actions={<span className="text-xs text-zinc-500">Clic para filtrar</span>}>
          <div className="flex h-full items-center">
            <Dona
              tamano={150}
              aria="Proporción de no conformidades y oportunidades de mejora"
              centroLabel="hallazgos"
              seleccionado={tipo || undefined}
              onSelect={(k) => setTipo(tipo === k ? '' : (k as TipoHallazgo))}
              segmentos={[
                { key: 'NC', label: 'No conformidad', valor: d.nTipo.NC, color: 'var(--viz-nc)' },
                { key: 'OM', label: 'Oport. de mejora', valor: d.nTipo.OM, color: 'var(--viz-om)' },
              ]}
            />
          </div>
        </Card>
        <Card className="flex flex-col" title="Nivel de impacto">
          {d.hs.length === 0 ? vacio('Sin datos.') : (
            <div className="flex h-full flex-col justify-center">
              <BarrasProgreso
                filas={[
                  { key: 'BAJA', label: 'Baja', valor: d.nivel[0].valor, color: 'var(--viz-seq-1)' },
                  { key: 'MEDIA', label: 'Media', valor: d.nivel[1].valor, color: 'var(--viz-seq-2)' },
                  { key: 'ALTA', label: 'Alta', valor: d.nivel[2].valor, color: 'var(--viz-seq-3)' },
                ]}
              />
            </div>
          )}
        </Card>
        <Card className="flex flex-col md:col-span-2 xl:col-span-1" title="Hallazgos por norma ISO" actions={<span className="text-xs text-zinc-500">Un hallazgo puede tocar varias</span>}>
          {d.hs.length === 0 ? vacio('Sin datos.') : (
            <div className="flex h-full flex-col justify-center">
              <BarrasProgreso
                filas={[
                  { key: 'ISO 9001', label: 'ISO 9001 · Calidad', valor: d.porNorma[0].valor, color: 'var(--viz-y2)' },
                  { key: 'ISO 14001', label: 'ISO 14001 · Medio ambiente', valor: d.porNorma[1].valor, color: 'var(--viz-good)' },
                  { key: 'ISO 45001', label: 'ISO 45001 · Seguridad y salud', valor: d.porNorma[2].valor, color: 'var(--viz-warning)' },
                ]}
              />
            </div>
          )}
        </Card>
      </div>

      {/* ---------- Fila 3: por área (ancho completo) ---------- */}
      <Card title="Hallazgos por área" actions={<span className="text-xs text-zinc-500">Clic en una columna para filtrar</span>}>
        {d.porAreaSucursal.length === 0 ? vacio('Sin áreas para los filtros seleccionados.') : (
          <div className={'grid gap-6 ' + (d.porAreaSucursal.length > 1 ? 'xl:grid-cols-2' : '')}>
            {d.porAreaSucursal.map((s) => (
              <div key={s.id || 'sin'} className="min-w-0">
                <p className="mb-2 flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-600">
                  <MapPin className="h-3.5 w-3.5 text-brand" /> {s.nombre}
                  <span className="font-normal normal-case tracking-normal text-zinc-500">· {s.areas.reduce((n, x) => n + x.valores.NC, 0)} NC · {s.areas.reduce((n, x) => n + x.valores.OM, 0)} OM</span>
                </p>
                <ColumnasApiladas
                  datos={s.areas}
                  etiquetasLargas
                  alto={230}
                  leyenda={false}
                  seleccionado={area ? (s.areas.findIndex((x) => x.id === area) >= 0 ? s.areas.findIndex((x) => x.id === area) : -1) : null}
                  onSelect={(i) => setArea(area === s.areas[i].id ? '' : s.areas[i].id)}
                  series={seriesTipo}
                />
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* ---------- Fila 4: sucursales (detalle + cara a cara) ---------- */}
      <div className="grid items-stretch gap-4 xl:grid-cols-2">
        <Card className="flex flex-col" title="Por sucursal" actions={<span className="text-xs text-zinc-500">Clic para filtrar</span>}>
          <ul className="flex h-full flex-col justify-center gap-3">
            {d.porSucursal.map((s) => {
              const tot = s.nc + s.om;
              return (
                <li key={s.id}>
                  <button
                    type="button"
                    onClick={() => cambiarSucursal(sucursal === s.id ? '' : s.id)}
                    className={'w-full cursor-pointer rounded-xl border p-3 text-left transition-all duration-200 hover:bg-zinc-50 ' + (sucursal === s.id ? 'border-brand ring-1 ring-brand' : sucursal ? 'border-zinc-200 opacity-60' : 'border-zinc-200')}
                  >
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="flex items-center gap-2 text-sm font-bold uppercase text-zinc-900"><MapPin className="h-4 w-4 text-brand" /> {s.label}</span>
                      <span className="font-[family-name:var(--font-display)] text-2xl font-bold leading-none text-zinc-900">{s.valor}</span>
                    </span>
                    <span className="mt-2.5 flex h-2 w-full gap-[2px] overflow-hidden rounded-full bg-zinc-100">
                      {tot > 0 && <span key={'nc' + s.nc} className="viz-fila h-full" style={{ width: `${(s.nc / tot) * 100}%`, background: 'var(--viz-nc)' }} />}
                      {tot > 0 && <span key={'om' + s.om} className="viz-fila h-full" style={{ width: `${(s.om / tot) * 100}%`, background: 'var(--viz-om)', animationDelay: '80ms' }} />}
                    </span>
                    <span className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-600">
                      <span>{s.nc} NC</span>
                      <span>{s.om} OM</span>
                      <span>{s.abiertos} abiertos</span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
        <Card className="flex flex-col" title={d.versus ? `${d.versus.a} vs ${d.versus.b}` : 'Comparación entre sucursales'} actions={<span className="text-xs text-zinc-500">{anio === null ? 'Todos los años' : anio}</span>}>
          {d.versus ? (
            <div className="flex h-full flex-col justify-center">
              <Versus nombreA={d.versus.a} nombreB={d.versus.b} colorA="var(--viz-y3)" colorB="var(--color-brand)" filas={d.versus.filas} />
            </div>
          ) : vacio('Se necesitan dos sucursales para comparar.')}
        </Card>
      </div>

      {/* ---------- Fila 5: avance anual ---------- */}
      <Card title={`Avance anual · ${d.aniosComp[0]}–${d.aniosComp[d.aniosComp.length - 1]}`} actions={<span className="text-xs text-zinc-500">{tipo ? `Solo ${tipo}` : 'NC + OM'}{sucursal ? ` · ${mapa.sucursales[sucursal]?.nombre}` : ''}</span>}>
        <EvolucionAnual anios={d.aniosComp} resumen={d.resumenAnual} filas={d.evolucion} tipo={tipo} />
      </Card>

      {/* ---------- Fila 6: seguimiento ---------- */}
      <div className="grid items-stretch gap-4 xl:grid-cols-2">
        <Card title={`Alertas de plazo (${d.alertas.length})`}>
          {d.alertas.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin hallazgos vencidos ni próximos a vencer.</p>
          ) : (
            <ul className="divide-y divide-zinc-100">
              {d.alertas.map((h) => (
                <li key={h.id}>
                  <Link to={`/hallazgos/${h.id}`} className="flex items-center gap-2 py-2 hover:bg-zinc-50">
                    <TipoBadge tipo={h.tipo} />
                    <span className="min-w-0 flex-1 truncate text-sm">{mapa.auditorias[h.auditoriaId]?.codigo} #{h.correlativo} · {nombreArea(h.areaId)}</span>
                    <PlazoBadge h={h} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Card>
        <Card className="flex flex-col" title="Agenda de auditorías">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">Próximos 30 días</p>
          {d.proximas.length === 0 ? (
            <p className="text-sm text-zinc-500">Sin actividades programadas en los próximos 30 días.</p>
          ) : (
            <ul className="space-y-2">
              {d.proximas.slice(0, 6).map((e) => (
                <li key={e.id}>
                  <Link to={`/calendario?ver=${e.id}`} className="flex items-center gap-3 rounded-lg border border-zinc-200 p-2 transition-colors hover:bg-zinc-50">
                    <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-panel text-xs font-bold text-brand" title={TIPO_PROGRAMA[e.tipo].label}>{TIPO_PROGRAMA[e.tipo].letra}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <b className="truncate text-sm">{e.auditoria?.codigo ?? TIPO_PROGRAMA[e.tipo].label}</b>
                        <span className="shrink-0 text-xs text-zinc-500">{fmtFecha(e.fecha)}</span>
                      </div>
                      <p className="truncate text-xs text-zinc-600">{mapa.areas[e.areaId]?.nombre} · {mapa.sucursales[e.sucursalId]?.nombre} · {mapa.auditores[e.liderId]?.nombre ?? '—'}</p>
                    </div>
                  </Link>
                </li>
              ))}
              {d.proximas.length > 6 && <li><Link to="/calendario" className="text-xs font-semibold underline">Ver {d.proximas.length - 6} más en el Calendario</Link></li>}
            </ul>
          )}
          <p className="mb-2 mt-5 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">En curso</p>
          {enCurso.length === 0 ? (
            <p className="text-sm text-zinc-500">Ninguna auditoría en ejecución.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {enCurso.map((a) => (
                <Link key={a.id} to={`/auditorias/${a.id}`} className="flex items-center gap-2 rounded-lg border border-zinc-200 px-3 py-2 text-sm transition-colors hover:bg-zinc-50">
                  <b>{a.codigo}</b> {nombreArea(a.areaId)} <EstadoAuditoriaBadge estado={a.estado} />
                </Link>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card title="Últimos hallazgos" actions={<Link to="/hallazgos" className="text-xs font-semibold underline">Ver todos</Link>}>
          {d.hs.length === 0 ? (
            <EmptyState title="Aún no hay hallazgos">Se crean desde el checklist o la hoja Hallazgos de cada auditoría.</EmptyState>
          ) : (
            <div className="table-wrap border-0">
              <table className="tabla">
                <thead>
                  <tr><th>Auditoría</th><th>Tipo</th><th>Descripción</th><th>Nivel</th><th>Estado</th></tr>
                </thead>
                <tbody>
                  {d.hs.slice(0, 5).map((h) => (
                    <tr key={h.id}>
                      <td className="whitespace-nowrap"><Link className="font-semibold underline" to={`/hallazgos/${h.id}`}>{mapa.auditorias[h.auditoriaId]?.codigo} #{h.correlativo}</Link></td>
                      <td><TipoBadge tipo={h.tipo} /></td>
                      <td className="max-w-md"><span className="line-clamp-2">{h.descripcion}</span></td>
                      <td><NivelBadge nivel={h.nivel} /></td>
                      <td><EstadoHallazgoBadge estado={h.estado} anulado={h.anulado} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
      </Card>
    </div>
  );
}
