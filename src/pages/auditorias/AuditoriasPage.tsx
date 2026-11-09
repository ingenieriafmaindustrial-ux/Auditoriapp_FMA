import { useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { History, Plus, Search, Trash2 } from 'lucide-react';
import { Badge, Button, EmptyState, Input, PageHeader, Select, Spinner } from '../../components/ui';
import { EliminarAuditoriaModal } from '../../components/shared/EliminarAuditoriaModal';
import type { Auditoria } from '../../types';
import { EstadoAuditoriaBadge } from '../../components/shared/Badges';
import { useData } from '../../context/DataContext';
import { useUsuario } from '../../context/AuthContext';
import { ESTADOS_AUDITORIA } from '../../lib/constants';
import { aniosDisponibles, anioActual, fmtFecha } from '../../lib/dates';
import { Hojas } from '../../components/layout/SheetTabs';
import { normalizar } from '../../lib/utils';
import { esAdminTI, esGestor } from '../../domain/permisos';
import { AuditoriaFormModal } from './AuditoriaFormModal';
import { ImportarHistoricoModal } from './ImportarHistoricoModal';

const POR_PAGINA = 15;

export default function AuditoriasPage() {
  const u = useUsuario();
  const nav = useNavigate();
  const { auditorias, hallazgos, mapa, sucursales, cargando } = useData();
  const [anio, setAnio] = useState(String(anioActual()));
  const [sucursal, setSucursal] = useState('');
  const [estado, setEstado] = useState('');
  const [q, setQ] = useState('');
  const [pagina, setPagina] = useState(1);
  const [nueva, setNueva] = useState(false);
  const [importar, setImportar] = useState(false);
  const [borrar, setBorrar] = useState<Auditoria | null>(null);
  const lider = esAdminTI(u);

  const anios = aniosDisponibles(auditorias.map((a) => a.anio));

  const filtradas = useMemo(() => {
    const nq = normalizar(q);
    return auditorias.filter(
      (a) =>
        (!anio || a.anio === Number(anio)) &&
        (!sucursal || a.sucursalId === sucursal) &&
        (!estado || a.estado === estado) &&
        (!nq || normalizar(`${a.codigo} ${mapa.areas[a.areaId]?.nombre} ${mapa.auditores[a.auditorLiderId]?.nombre} ${a.alcance}`).includes(nq)),
    );
  }, [auditorias, anio, sucursal, estado, q, mapa]);

  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA));
  const visibles = filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA);
  const conteo = (id: string, t: 'NC' | 'OM') => hallazgos.filter((h) => h.auditoriaId === id && h.tipo === t && !h.anulado).length;

  if (cargando) return <Spinner />;

  return (
    <div>
      <PageHeader
        title="Auditorías"
        subtitle={`${filtradas.length} auditoría(s) en ${anio}`}
        actions={esGestor(u.rol) && (
          <div className="flex flex-wrap gap-2">
            {lider && <Button icon={<History className="h-4 w-4" />} onClick={() => setImportar(true)}>Importar histórico</Button>}
            <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setNueva(true)}>Nueva auditoría</Button>
          </div>
        )}
      />

      {/* Hojas por año */}
      <Hojas
        activa={anio}
        onChange={(k) => { setAnio(k); setPagina(1); }}
        hojas={anios.map((y) => ({ key: String(y), label: String(y), badge: auditorias.filter((a) => a.anio === y).length || undefined }))}
      />
      <div className="mb-3 grid grid-cols-1 gap-2 rounded-b-xl border border-t-0 border-zinc-300 bg-surface p-3 sm:grid-cols-3">
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-400" />
          <Input className="pl-9" placeholder="Buscar…" value={q} onChange={(e) => { setQ(e.target.value); setPagina(1); }} />
        </div>
        <Select value={sucursal} onChange={(e) => { setSucursal(e.target.value); setPagina(1); }} placeholder="Todas las sucursales" options={sucursales.map((s) => ({ value: s.id, label: s.nombre }))} />
        <Select value={estado} onChange={(e) => { setEstado(e.target.value); setPagina(1); }} placeholder="Todos los estados" options={Object.entries(ESTADOS_AUDITORIA).map(([value, label]) => ({ value, label }))} />
      </div>

      {filtradas.length === 0 ? (
        <EmptyState title={`No hay auditorías en ${anio}`} action={esGestor(u.rol) && <Button variant="primary" onClick={() => setNueva(true)}>Crear la primera</Button>}>
          {u.rol === 'auditor' ? 'Solo ves las auditorías en las que participas.' : 'Ajusta los filtros o crea una nueva auditoría.'}
        </EmptyState>
      ) : (
        <>
          <div className="table-wrap">
            <table className="tabla">
              <thead>
                <tr>
                  <th>N°</th>
                  <th>Sucursal</th>
                  <th>Área</th>
                  <th>Fecha</th>
                  <th>Auditor líder</th>
                  <th className="text-center">NC / OM</th>
                  <th>Estado</th>
                  {lider && <th className="w-24 text-right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {visibles.map((a) => (
                  <tr key={a.id} className="cursor-pointer hover:bg-zinc-50" onClick={() => nav(`/auditorias/${a.id}`)}>
                    <td className="font-bold"><Link to={`/auditorias/${a.id}`}>{a.codigo}</Link>{a.importada && <Badge className="ml-2 bg-violet-100 text-violet-800" >Importada</Badge>}</td>
                    <td>{mapa.sucursales[a.sucursalId]?.nombre ?? '—'}</td>
                    <td>{mapa.areas[a.areaId]?.nombre ?? '—'}</td>
                    <td className="whitespace-nowrap">{fmtFecha(a.fechaRealizacion ?? a.fechaPlanificada)}</td>
                    <td>{mapa.auditores[a.auditorLiderId]?.nombre ?? '—'}</td>
                    <td className="text-center whitespace-nowrap">
                      <span className="font-semibold text-red-700">{conteo(a.id, 'NC')}</span> / <span className="font-semibold text-sky-700">{conteo(a.id, 'OM')}</span>
                    </td>
                    <td><EstadoAuditoriaBadge estado={a.estado} /></td>
                    {lider && (
                      <td className="text-right" onClick={(e) => e.stopPropagation()}>
                        <Button size="sm" variant="danger" icon={<Trash2 className="h-3.5 w-3.5" />} onClick={() => setBorrar(a)} aria-label={`Eliminar auditoría ${a.codigo}`}>
                          Eliminar
                        </Button>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {paginas > 1 && (
            <div className="mt-3 flex items-center justify-end gap-2 text-sm">
              <Button size="sm" disabled={pagina === 1} onClick={() => setPagina((p) => p - 1)}>Anterior</Button>
              <span>Página {pagina} de {paginas}</span>
              <Button size="sm" disabled={pagina === paginas} onClick={() => setPagina((p) => p + 1)}>Siguiente</Button>
            </div>
          )}
        </>
      )}

      <EliminarAuditoriaModal
        auditoria={borrar}
        open={!!borrar}
        onClose={() => setBorrar(null)}
        nHallazgos={borrar ? conteo(borrar.id, 'NC') + conteo(borrar.id, 'OM') : 0}
        detalle={borrar ? `${mapa.areas[borrar.areaId]?.nombre ?? ''} · ${mapa.sucursales[borrar.sucursalId]?.nombre ?? ''}` : undefined}
      />

      {lider && <ImportarHistoricoModal open={importar} onClose={() => setImportar(false)} />}
      <AuditoriaFormModal anioInicial={Number(anio)} open={nueva} onClose={() => setNueva(false)} onCreada={(id) => nav(`/auditorias/${id}`)} />
    </div>
  );
}
