import { useState, type ReactNode } from 'react';
import { Ban, Building2, Download, ClipboardList, FileUp, ChevronDown, ChevronRight, Database, MapPin, Pencil, Plus, Save, Search, Trash2 } from 'lucide-react';
import { Alerta, Badge, Button, CheckboxGroup, EmptyState, ErrorList, Field, Input, Modal, PageHeader, Select } from '../../components/ui';
import { cn } from '../../lib/utils';
import { Hojas } from '../../components/layout/SheetTabs';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { NORMAS } from '../../lib/constants';
import { errorMensaje, normalizar } from '../../lib/utils';
import { actualizarRequisitos14001, requisitos14001Vigentes, cambiarActivo, cargarDatosIniciales, desactivarItemsCatalogo, eliminarItemsCatalogo, guardarItemCatalogo } from '../../services/catalogos';
import type { Area, Norma } from '../../types';
import { PlanAreaModal } from './PlanAreaModal';
import { PlanPdfModal } from '../auditorias/hoja/PlanPdfModal';
import { ImportarPlanesModal } from './ImportarPlanesModal';
import { IconoAsistente } from '../../components/shared/AsistenteNormas';
import { reentrenarAsistente, useAprendizaje } from '../../services/aprendizaje';

type HojaCat = 'sucursales' | 'areas' | 'auditores' | 'requisitos';
type Registro = Record<string, unknown> & { id?: string };

/** Encabezado desplegable (acordeón). */
function Seccion({ abierto, onToggle, icono, titulo, resumen, acciones, children }: { abierto: boolean; onToggle: () => void; icono: ReactNode; titulo: ReactNode; resumen: ReactNode; acciones?: ReactNode; children: ReactNode }) {
  return (
    <section className={cn('overflow-hidden rounded-xl border bg-surface transition', abierto ? 'border-zinc-300 shadow-sm' : 'border-zinc-200')}>
      <div className="flex flex-wrap items-center gap-2 px-3 py-2.5 hover:bg-zinc-50 sm:px-4">
        <button type="button" className="flex min-w-0 flex-1 items-center gap-2.5 text-left" onClick={onToggle} aria-expanded={abierto}>
          {abierto ? <ChevronDown className="h-4 w-4 shrink-0 text-zinc-500" /> : <ChevronRight className="h-4 w-4 shrink-0 text-zinc-500" />}
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-panel text-brand">{icono}</span>
          <span className="min-w-0">
            <b className="block truncate font-[family-name:var(--font-display)] text-lg uppercase leading-tight text-zinc-900">{titulo}</b>
            <span className="block text-xs text-zinc-500">{resumen}</span>
          </span>
        </button>
        {acciones}
      </div>
      {abierto && <div className="border-t border-zinc-100">{children}</div>}
    </section>
  );
}

export default function CatalogosPage() {
  const u = useUsuario();
  const notify = useToast();
  const d = useData();
  const [hoja, setHoja] = useState<Exclude<HojaCat, 'sucursales'>>('areas');
  const [editHoja, setEditHoja] = useState<HojaCat>('areas');
  const [abiertos, setAbiertos] = useState<Record<string, boolean>>({});
  const [q, setQ] = useState('');
  const [edit, setEdit] = useState<Registro | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [seeding, setSeeding] = useState(false);
  const [act14, setAct14] = useState(false);
  const [sel, setSel] = useState<string[]>([]);
  const [borrar, setBorrarState] = useState<{ ids: string[]; hoja: HojaCat } | null>(null);
  const setBorrar = (ids: string[] | null, h: HojaCat = borrar?.hoja ?? hoja) => setBorrarState(ids ? { ids, hoja: h } : null);
  const [borrando, setBorrando] = useState(false);
  const aprendidos = useAprendizaje();
  const [entrenando, setEntrenando] = useState(false);
  const [planArea, setPlanArea] = useState<Area | null>(null);
  const [exportarArea, setExportarArea] = useState<Area | null>(null);
  const [importando, setImportando] = useState(false);

  /** Dónde se usa un registro: si tiene usos, no se elimina (se conserva la trazabilidad de auditorías pasadas). */
  function usosDe(id: string, hoja: HojaCat = borrar?.hoja ?? editHoja): string[] {
    const u: string[] = [];
    const n = (x: number, t: string) => x > 0 && u.push(`${x} ${t}`);
    if (hoja === 'auditores') {
      n(d.auditorias.filter((a) => a.auditorLiderId === id || a.equipoIds.includes(id) || a.agenda?.some((g) => g.auditorId === id)).length, 'auditoría(s)');
      n(d.hallazgos.filter((h) => h.auditorResponsableId === id || h.verificaciones.some((v) => v.auditorId === id)).length, 'hallazgo(s)');
      const cuenta = d.usuarios.find((x) => x.auditorId === id);
      if (cuenta) u.push(`vinculado a la cuenta ${cuenta.email}`);
    } else if (hoja === 'areas') {
      n(d.auditorias.filter((a) => a.areaId === id).length, 'auditoría(s)');
      n(d.auditores.filter((a) => a.areaOrigenId === id).length, 'auditor(es)');
    } else if (hoja === 'sucursales') {
      n(d.auditorias.filter((a) => a.sucursalId === id).length, 'auditoría(s)');
      n(d.auditores.filter((a) => a.sucursalId === id).length, 'auditor(es)');
    } else {
      n(d.hallazgos.filter((h) => h.requisitoIds.includes(id)).length, 'hallazgo(s)');
    }
    return u;
  }

  const etiqueta = (id: string, hoja: HojaCat = borrar?.hoja ?? editHoja) => {
    const r = (d.mapa as unknown as Record<string, Record<string, Registro>>)[hoja]?.[id];
    return r ? String(hoja === 'requisitos' ? `${r.norma} ${r.clausula}` : r.nombre) : id;
  };

  const vacio = !d.areas.length && !d.sucursales.length && !d.auditores.length && !d.requisitos.length;

  const nq = normalizar(q);
  const coincide = (t: string) => !nq || normalizar(t).includes(nq);
  const areasFiltradas = d.areas.filter((x) => coincide(`${x.nombre} ${x.encargado ?? ''} ${x.cargoEncargado ?? ''}`));
  const auditoresFiltrados = d.auditores.filter((x) => coincide(`${x.nombre} ${x.cargo}`));
  const requisitosFiltrados = d.requisitos.filter((x) => coincide(`${x.norma} ${x.clausula} ${x.titulo}`));
  const estaAbierto = (k: string, porDefecto: boolean) => abiertos[k] ?? (nq ? true : porDefecto);
  const alternar = (k: string, porDefecto: boolean) => setAbiertos((p) => ({ ...p, [k]: !estaAbierto(k, porDefecto) }));

  async function guardar() {
    if (!edit) return;
    const hoja = editHoja;
    const e: string[] = [];
    if (hoja === 'requisitos') {
      if (!edit.norma) e.push('Seleccione la norma.');
      if (!String(edit.clausula ?? '').trim()) e.push('Indique la cláusula.');
      if (!String(edit.titulo ?? '').trim()) e.push('Indique el título.');
    } else if (!String(edit.nombre ?? '').trim()) e.push('Indique el nombre.');
    if (hoja === 'areas' && !edit.sucursalId) e.push('Seleccione la sucursal del área (Santiago / Antofagasta).');
    setErrores(e);
    if (e.length) return;
    const { id, ...data } = edit;
    if (hoja === 'requisitos' && data.orden === undefined) data.orden = d.requisitos.length;
    try {
      await guardarItemCatalogo(u, hoja, (id as string) ?? null, { activo: true, ...data });
      notify('Guardado');
      setEdit(null);
    } catch (err) {
      setErrores([errorMensaje(err)]);
    }
  }

  const nuevo = (hoja: HojaCat): Registro =>
    hoja === 'auditores' ? { nombre: '', cargo: '', sucursalId: null, areaOrigenId: null } : hoja === 'areas' ? { nombre: '', sucursalId: null, encargado: '', cargoEncargado: '' } : hoja === 'requisitos' ? { norma: 'ISO 9001', clausula: '', titulo: '' } : { nombre: '' };

  const str = (v: unknown) => (typeof v === 'string' ? v : '');
  const abrir = (h: HojaCat, r: Registro) => { setErrores([]); setEditHoja(h); setEdit(r); };

  /** Tabla reutilizable para áreas, auditores y requisitos. */
  function tabla(filas: Registro[], h: HojaCat): ReactNode {
    if (!filas.length) return <p className="px-3 py-4 text-sm text-zinc-500">Sin registros.</p>;
    const ids = filas.map((f) => String(f.id));
    return (
      <div className="table-wrap border-0">
        <table className="tabla">
          <thead>
            <tr>
              <th className="w-8">
                <input type="checkbox" aria-label="Seleccionar todos" className="accent-panel" checked={ids.every((id) => sel.includes(id))} onChange={(e) => setSel(e.target.checked ? [...new Set([...sel, ...ids])] : sel.filter((x) => !ids.includes(x)))} />
              </th>
              {h === 'requisitos' ? <><th className="w-24">Cláusula</th><th>Título</th></> : <th>Nombre</th>}
              {h === 'areas' && <><th>Encargado</th><th className="w-28">Plan</th></>}
              {h === 'auditores' && <><th>Cargo</th><th>Sucursal</th><th>Área de origen</th><th>Cuenta</th></>}
              <th className="w-20">Estado</th>
              <th className="w-20" />
            </tr>
          </thead>
          <tbody>
            {filas.map((raw) => {
              const r = raw as Registro & { id: string; activo: boolean };
              const cuenta = h === 'auditores' ? d.usuarios.find((x) => x.auditorId === r.id) : undefined;
              return (
                <tr key={r.id} className={(r.activo ? '' : 'opacity-50 ') + (sel.includes(r.id) ? 'bg-amber-50' : '')}>
                  <td><input type="checkbox" aria-label="Seleccionar" className="accent-panel" checked={sel.includes(r.id)} onChange={(e) => setSel(e.target.checked ? [...sel, r.id] : sel.filter((x) => x !== r.id))} /></td>
                  {h === 'requisitos' ? (
                    <><td className="font-semibold">{str(r.clausula)}</td><td>{str(r.titulo)}</td></>
                  ) : (
                    <td className="font-medium">{str(r.nombre)}</td>
                  )}
                  {h === 'areas' && (
                    <td>
                      {str(r.encargado) ? (
                        <><span className="font-medium">{str(r.encargado)}</span>{str(r.cargoEncargado) && <span className="block text-xs text-zinc-500">{str(r.cargoEncargado)}</span>}</>
                      ) : <span className="text-amber-700">Sin encargado</span>}
                    </td>
                  )}
                  {h === 'areas' && (
                    <td>
                      {(() => {
                        const n = (d.mapa.areas[r.id]?.plan ?? []).length;
                        return (
                          <button
                            type="button"
                            title="Editar plan de auditoría del área"
                            className={cn('inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-semibold', n ? 'border-violet-300 bg-violet-50 text-violet-800 hover:bg-violet-100' : 'border-dashed border-zinc-300 text-zinc-500 hover:border-violet-400 hover:text-violet-700')}
                            onClick={() => d.mapa.areas[r.id] && setPlanArea(d.mapa.areas[r.id])}
                          >
                            <ClipboardList className="h-3.5 w-3.5" /> {n ? `${n} puntos` : 'Sin plan'}
                          </button>
                        );
                      })()}
                    </td>
                  )}
                  {h === 'auditores' && (
                    <>
                      <td>{str(r.cargo) || '—'}</td>
                      <td>{d.mapa.sucursales[str(r.sucursalId)]?.nombre ?? '—'}</td>
                      <td>{d.mapa.areas[str(r.areaOrigenId)]?.nombre ?? <span className="text-amber-700">Sin definir</span>}</td>
                      <td>{cuenta ? <Badge className="bg-panel text-brand">{cuenta.email}</Badge> : '—'}</td>
                    </>
                  )}
                  <td>
                    <button className="text-xs underline" onClick={() => cambiarActivo(h, r.id, !r.activo).catch((e) => notify(errorMensaje(e), 'error'))}>{r.activo ? 'Activo' : 'Inactivo'}</button>
                  </td>
                  <td className="whitespace-nowrap text-right">
                    {h === 'areas' && (
                      <button
                        type="button"
                        disabled={!(d.mapa.areas[r.id]?.plan ?? []).length}
                        title={(d.mapa.areas[r.id]?.plan ?? []).length ? 'Exportar el plan de auditoría del área en PDF' : 'El área aún no tiene plan cargado'}
                        className="mr-1 inline-flex items-center gap-1 rounded-md border border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-700 hover:border-zinc-500 disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => d.mapa.areas[r.id] && setExportarArea(d.mapa.areas[r.id])}
                      >
                        <Download className="h-3.5 w-3.5" /> Exportar plan
                      </button>
                    )}
                    <button aria-label="Editar" title="Editar" className="p-1.5 text-zinc-500 hover:text-zinc-900" onClick={() => abrir(h, { ...r })}><Pencil className="h-4 w-4" /></button>
                    <button aria-label="Eliminar" title="Eliminar" className="p-1.5 text-zinc-400 hover:text-red-600" onClick={() => setBorrar([r.id], h)}><Trash2 className="h-4 w-4" /></button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  }

  const gruposSucursal = [
    ...d.sucursales.map((s) => ({ id: s.id, nombre: s.nombre, activo: s.activo, areas: areasFiltradas.filter((a) => a.sucursalId === s.id) })),
    ...(areasFiltradas.some((a) => !a.sucursalId || !d.mapa.sucursales[a.sucursalId]) ? [{ id: '__sin', nombre: 'Sin sucursal asignada', activo: true, areas: areasFiltradas.filter((a) => !a.sucursalId || !d.mapa.sucursales[a.sucursalId]) }] : []),
  ];
  const capitulos: Record<string, string> = { '4': 'Contexto de la organización', '5': 'Liderazgo', '6': 'Planificación', '7': 'Apoyo', '8': 'Operación', '9': 'Evaluación del desempeño', '10': 'Mejora' };
  const accionAgregar = hoja === 'areas' ? 'Nueva área' : hoja === 'auditores' ? 'Nuevo auditor' : 'Nuevo requisito';

  return (
    <div>
      <PageHeader
        title="Sucursales"
        subtitle="Sucursales y sus áreas, auditores y requisitos usados en auditorías e informes"
        actions={
          <div className="flex flex-wrap gap-2">
            {hoja === 'areas' && <Button icon={<FileUp className="h-4 w-4" />} onClick={() => setImportando(true)}>Importar planes (Word)</Button>}
            {hoja === 'areas' && <Button icon={<Building2 className="h-4 w-4" />} onClick={() => abrir('sucursales', nuevo('sucursales'))}>Nueva sucursal</Button>}
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => abrir(hoja, nuevo(hoja))}>{accionAgregar}</Button>
          </div>
        }
      />

      {vacio && (
        <div className="mb-4">
          <Alerta tipo="info">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span>Los catálogos están vacíos. Carga las sucursales, áreas y auditores de la plantilla v10/2024 y las cláusulas de ISO 9001, 14001 y 45001.</span>
              <Button variant="dark" size="sm" loading={seeding} icon={<Database className="h-4 w-4" />} onClick={async () => { setSeeding(true); try { await cargarDatosIniciales(u); notify('Datos iniciales cargados'); } catch (e) { notify(errorMensaje(e), 'error'); } finally { setSeeding(false); } }}>
                Cargar datos iniciales
              </Button>
            </div>
          </Alerta>
        </div>
      )}

      <Hojas
        activa={hoja}
        onChange={(k) => { setHoja(k as typeof hoja); setQ(''); setSel([]); setAbiertos({}); }}
        hojas={[
          { key: 'areas', label: 'Áreas', badge: d.areas.length },
          { key: 'auditores', label: 'Auditores', badge: d.auditores.length },
          { key: 'requisitos', label: 'Requisitos ISO', badge: d.requisitos.length },
        ]}
      />
      <div className="rounded-b-xl border border-t-0 border-zinc-300 bg-surface p-3 sm:p-4">
        {hoja === 'requisitos' && !requisitos14001Vigentes(d.requisitos) && (
          <div className="mb-3">
            <Alerta tipo="warn">
              <div className="flex flex-wrap items-center gap-3">
                <span className="min-w-0 flex-1">La norma vigente es <b>ISO 14001:2026</b>. Actualiza el catálogo para agregar las cláusulas nuevas (6.1.4, 6.1.5, 6.3) y retirar las que ya no existen. Los hallazgos históricos se conservan.</span>
                <Button size="sm" variant="dark" loading={act14} onClick={async () => {
                  setAct14(true);
                  try { const r = await actualizarRequisitos14001(u, d.requisitos); notify(`ISO 14001:2026: ${r.agregados} nueva(s), ${r.actualizados} actualizada(s), ${r.retirados} retirada(s)`); }
                  catch (e) { notify(errorMensaje(e), 'error'); } finally { setAct14(false); }
                }}>Actualizar a ISO 14001:2026</Button>
              </div>
            </Alerta>
          </div>
        )}
        {hoja === 'requisitos' && (
          <div className="asis-idle mb-3 flex-wrap">
            <IconoAsistente size={34} activo={entrenando} />
            <p className="min-w-0 flex-1 text-xs text-zinc-600">
              <b className="text-zinc-800">Asistente de auditoría.</b> Memoria: 163 hallazgos históricos 2023–2026 + <b>{aprendidos.filter((a) => !a.anulado).length}</b> aprendidos en la app. Aprende solo cada vez que cualquier auditor guarda un hallazgo; usa este botón para incorporar hallazgos creados antes de activarlo.
            </p>
            <Button size="sm" loading={entrenando} onClick={async () => {
              setEntrenando(true);
              try {
                const n = await reentrenarAsistente(u, d.hallazgos, { areas: d.mapa.areas, sucursales: d.mapa.sucursales, requisitos: d.mapa.requisitos });
                notify(`Asistente entrenado con ${n} hallazgo(s)`);
              } catch (e) { notify(errorMensaje(e), 'error'); } finally { setEntrenando(false); }
            }}>
              Entrenar con hallazgos existentes
            </Button>
          </div>
        )}

        <div className="mb-3 flex flex-wrap items-center gap-2">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
            <Input className="pl-9" placeholder={hoja === 'areas' ? 'Buscar área o encargado…' : hoja === 'requisitos' ? 'Buscar cláusula o título (ej.: 7.1.5 o calibración)…' : 'Buscar…'} value={q} onChange={(e) => setQ(e.target.value)} />
          </div>
          {hoja !== 'auditores' && (
            <button type="button" className="chip" onClick={() => {
              const keys = hoja === 'areas' ? gruposSucursal.map((g) => `s-${g.id}`) : NORMAS.map((n) => `n-${n}`);
              const todos = keys.every((k) => estaAbierto(k, hoja === 'areas'));
              setAbiertos(Object.fromEntries(keys.map((k) => [k, !todos])));
            }}>Expandir / contraer todo</button>
          )}
        </div>
        {hoja === 'auditores' && <p className="mb-2 text-xs text-zinc-500">El <b>área de origen</b> se usa para validar la independencia del auditor (RN-02).</p>}

        {sel.length > 0 && (
          <div className="mb-3 flex flex-wrap items-center gap-2 rounded-lg bg-panel px-3 py-2 text-sm text-white">
            <b className="text-brand">{sel.length}</b> seleccionado(s)
            <span className="flex-1" />
            <Button size="sm" variant="ghost" className="text-white hover:bg-white/10" onClick={() => setSel([])}>Limpiar</Button>
            <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setBorrar(sel, hoja)}>Eliminar seleccionados</Button>
          </div>
        )}

        {hoja === 'areas' && (
          gruposSucursal.length === 0 ? <EmptyState title="Aún no hay sucursales" /> : (
            <div className="space-y-2.5">
              {gruposSucursal.map((g) => {
                const suc = d.mapa.sucursales[g.id];
                const activas = g.areas.filter((a) => a.activo).length;
                const sinEnc = g.areas.filter((a) => a.activo && !a.encargado).length;
                return (
                  <Seccion
                    key={g.id}
                    abierto={estaAbierto(`s-${g.id}`, true)}
                    onToggle={() => alternar(`s-${g.id}`, true)}
                    icono={g.id === '__sin' ? <MapPin className="h-4 w-4" /> : <Building2 className="h-4 w-4" />}
                    titulo={<>{g.nombre}{suc && !suc.activo && <span className="ml-2 text-xs font-normal normal-case text-zinc-500">(inactiva)</span>}</>}
                    resumen={<>{g.areas.length} área(s) · {activas} activa(s){sinEnc > 0 && <span className="text-amber-700"> · {sinEnc} sin encargado</span>}</>}
                    acciones={suc && (
                      <div className="flex items-center gap-1">
                        <Button size="sm" variant="primary" icon={<Plus className="h-3.5 w-3.5" />} onClick={() => abrir('areas', { ...nuevo('areas'), sucursalId: suc.id })}>Área</Button>
                        <button aria-label={`Editar sucursal ${suc.nombre}`} title="Editar sucursal" className="p-1.5 text-zinc-500 hover:text-zinc-900" onClick={() => abrir('sucursales', { ...suc })}><Pencil className="h-4 w-4" /></button>
                        <button aria-label={`Eliminar sucursal ${suc.nombre}`} title="Eliminar sucursal" className="p-1.5 text-zinc-400 hover:text-red-600" onClick={() => setBorrar([suc.id], 'sucursales')}><Trash2 className="h-4 w-4" /></button>
                      </div>
                    )}
                  >
                    {tabla(g.areas as unknown as Registro[], 'areas')}
                  </Seccion>
                );
              })}
            </div>
          )
        )}

        {hoja === 'auditores' && (auditoresFiltrados.length ? <div className="table-wrap">{tabla(auditoresFiltrados as unknown as Registro[], 'auditores')}</div> : <EmptyState title="Sin registros" />)}

        {hoja === 'requisitos' && (
          <div className="space-y-2.5">
            {NORMAS.map((n) => {
              const lista = requisitosFiltrados.filter((r) => r.norma === n);
              const porCap = [...new Set(lista.map((r) => r.clausula.split('.')[0]))].sort((a, b) => Number(a) - Number(b));
              return (
                <Seccion
                  key={n}
                  abierto={estaAbierto(`n-${n}`, false)}
                  onToggle={() => alternar(`n-${n}`, false)}
                  icono={<span className="text-[10px] font-bold">{n.replace('ISO ', '')}</span>}
                  titulo={n}
                  resumen={<>{lista.length} cláusula(s){nq ? ' coinciden' : ''} · {n === 'ISO 9001' ? 'Calidad' : n === 'ISO 14001' ? 'Medio ambiente' : 'Seguridad y salud en el trabajo'}</>}
                >
                  {lista.length === 0 ? <p className="px-4 py-3 text-sm text-zinc-500">Sin cláusulas.</p> : porCap.map((cap) => {
                    const kc = `c-${n}-${cap}`;
                    const abiertoCap = estaAbierto(kc, false);
                    const filasCap = lista.filter((r) => r.clausula.split('.')[0] === cap);
                    return (
                      <div key={cap} className="border-b border-zinc-100 last:border-b-0">
                        <button type="button" onClick={() => alternar(kc, false)} aria-expanded={abiertoCap} className="flex w-full items-center gap-2 bg-zinc-50 px-4 py-2 text-left text-sm hover:bg-zinc-100">
                          {abiertoCap ? <ChevronDown className="h-3.5 w-3.5 text-zinc-500" /> : <ChevronRight className="h-3.5 w-3.5 text-zinc-500" />}
                          <b className="text-zinc-900">{cap}</b>
                          <span className="text-zinc-700">{capitulos[cap] ?? ''}</span>
                          <span className="ml-auto rounded-full bg-zinc-200 px-2 text-[11px] font-semibold text-zinc-700">{filasCap.length}</span>
                        </button>
                        {abiertoCap && tabla(filasCap as unknown as Registro[], 'requisitos')}
                      </div>
                    );
                  })}
                </Seccion>
              );
            })}
          </div>
        )}
      </div>

      <Modal open={!!edit} onClose={() => setEdit(null)} title={`${edit?.id ? 'Editar' : 'Agregar'} ${editHoja === 'sucursales' ? 'sucursal' : editHoja === 'areas' ? 'área' : editHoja === 'auditores' ? 'auditor' : 'requisito'}`} footer={<><Button onClick={() => setEdit(null)}>Cancelar</Button><Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={guardar}>Guardar</Button></>}>
        {edit && (
          <div className="space-y-3">
            {editHoja === 'requisitos' ? (
              <>
                <Field label="Norma">
                  <CheckboxGroup<Norma> options={NORMAS.map((n) => ({ value: n, label: n }))} value={edit.norma ? [edit.norma as Norma] : []} onChange={(v) => setEdit({ ...edit, norma: v[v.length - 1] ?? '' })} />
                </Field>
                <Field label="Cláusula"><Input value={str(edit.clausula)} onChange={(e) => setEdit({ ...edit, clausula: e.target.value })} placeholder="7.5.3" /></Field>
                <Field label="Título"><Input value={str(edit.titulo)} onChange={(e) => setEdit({ ...edit, titulo: e.target.value })} /></Field>
              </>
            ) : (
              <Field label="Nombre"><Input value={str(edit.nombre)} onChange={(e) => setEdit({ ...edit, nombre: e.target.value })} autoFocus /></Field>
            )}
            {editHoja === 'areas' && (
              <>
                <Field label="Sucursal">
                  <Select value={str(edit.sucursalId)} onChange={(e) => setEdit({ ...edit, sucursalId: e.target.value || null })} placeholder="Seleccione sucursal…" options={d.sucursales.map((x) => ({ value: x.id, label: x.nombre }))} />
                </Field>
                <Field label="Encargado / jefe de área" hint="Se propone automáticamente como auditado al crear una auditoría de esta área.">
                  <Input value={str(edit.encargado)} onChange={(e) => setEdit({ ...edit, encargado: e.target.value })} placeholder="Ej.: Pedro Orellana" />
                </Field>
                <Field label="Cargo del encargado (opcional)">
                  <Input value={str(edit.cargoEncargado)} onChange={(e) => setEdit({ ...edit, cargoEncargado: e.target.value })} placeholder="Ej.: Jefe de Adquisiciones" />
                </Field>
              </>
            )}
            {editHoja === 'auditores' && (
              <>
                <Field label="Cargo"><Input value={str(edit.cargo)} onChange={(e) => setEdit({ ...edit, cargo: e.target.value })} /></Field>
                <Field label="Sucursal"><Select value={str(edit.sucursalId)} onChange={(e) => setEdit({ ...edit, sucursalId: e.target.value || null })} placeholder="—" options={d.sucursales.map((s) => ({ value: s.id, label: s.nombre }))} /></Field>
                <Field label="Área de origen"><Select value={str(edit.areaOrigenId)} onChange={(e) => setEdit({ ...edit, areaOrigenId: e.target.value || null })} placeholder="—" options={d.areas.map((s) => ({ value: s.id, label: `${s.nombre}${s.sucursalId && d.mapa.sucursales[s.sucursalId] ? ` · ${d.mapa.sucursales[s.sucursalId].nombre}` : ''}` }))} /></Field>
              </>
            )}
            <ErrorList errores={errores} />
          </div>
        )}
      </Modal>

      {borrar && (() => {
        const hb = borrar.hoja;
        const libres = borrar.ids.filter((id) => usosDe(id).length === 0);
        const enUso = borrar.ids.filter((id) => usosDe(id).length > 0);
        return (
          <Modal
            open
            onClose={() => setBorrar(null)}
            title={`Eliminar ${borrar.ids.length === 1 ? 'registro' : borrar.ids.length + ' registros'}`}
            footer={
              <>
                <Button onClick={() => setBorrar(null)}>Cancelar</Button>
                {enUso.length > 0 && (
                  <Button
                    icon={<Ban className="h-4 w-4" />}
                    disabled={borrando}
                    onClick={async () => {
                      try {
                        await desactivarItemsCatalogo(hb, enUso);
                        notify(`${enUso.length} desactivado(s)`);
                        if (!libres.length) { setBorrar(null); setSel([]); } else setBorrar(libres, hb);
                      } catch (e) { notify(errorMensaje(e), 'error'); }
                    }}
                  >
                    Desactivar {enUso.length} en uso
                  </Button>
                )}
                {libres.length > 0 && (
                  <Button
                    variant="danger"
                    loading={borrando}
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={async () => {
                      setBorrando(true);
                      try {
                        await eliminarItemsCatalogo(u, hb, libres.map((id) => ({ id, etiqueta: etiqueta(id) })));
                        notify(`${libres.length} eliminado(s)`);
                        setSel((s) => s.filter((x) => !libres.includes(x)));
                        if (enUso.length) setBorrar(enUso, hb); else setBorrar(null);
                      } catch (e) { notify(errorMensaje(e), 'error'); } finally { setBorrando(false); }
                    }}
                  >
                    Eliminar {libres.length}
                  </Button>
                )}
              </>
            }
          >
            <div className="space-y-3 text-sm">
              {libres.length > 0 && (
                <div>
                  <p className="mb-1 font-semibold text-red-700">Se eliminarán definitivamente ({libres.length}):</p>
                  <ul className="max-h-40 list-inside list-disc overflow-y-auto text-zinc-700">{libres.map((id) => <li key={id}>{etiqueta(id)}</li>)}</ul>
                </div>
              )}
              {enUso.length > 0 && (
                <Alerta tipo="warn">
                  <p className="mb-1 font-semibold">No se pueden eliminar porque tienen historial ({enUso.length}). Puedes desactivarlos: dejan de aparecer en las listas, pero se conservan en auditorías e informes anteriores.</p>
                  <ul className="max-h-40 list-inside list-disc overflow-y-auto">{enUso.map((id) => <li key={id}><b>{etiqueta(id)}</b>: {usosDe(id).join(', ')}</li>)}</ul>
                </Alerta>
              )}
            </div>
          </Modal>
        );
      })()}
      {planArea && <PlanAreaModal area={planArea} onClose={() => setPlanArea(null)} />}
      {exportarArea && (
        <PlanPdfModal
          open
          onClose={() => setExportarArea(null)}
          base={{
            codigo: '', anio: new Date().getFullYear(),
            objetivos: 'Verificar el cumplimiento de los requisitos del sistema de gestión integrado en el área, de acuerdo con los puntos del plan de auditoría.',
            alcance: `Procesos del área ${exportarArea.nombre}${exportarArea.sucursalId && d.mapa.sucursales[exportarArea.sucursalId] ? ` · ${d.mapa.sucursales[exportarArea.sucursalId].nombre}` : ''}.`,
            sucursal: exportarArea.sucursalId ? d.mapa.sucursales[exportarArea.sucursalId]?.nombre ?? '' : '',
            area: exportarArea.nombre,
            auditados: [exportarArea.encargado, exportarArea.cargoEncargado].filter(Boolean).join(' · '),
            normas: NORMAS,
            puntos: (exportarArea.plan ?? []).map((p) => ({ titulo: p.titulo, grupo: '', requisitos: [], referencia: p.referencia })),
          }}
        />
      )}
      <ImportarPlanesModal open={importando} onClose={() => setImportando(false)} />
    </div>
  );
}
