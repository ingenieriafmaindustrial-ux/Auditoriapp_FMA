import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { Button, Card, EmptyState } from '../../../components/ui';
import { EstadoHallazgoBadge, NivelBadge, PlazoBadge, TipoBadge } from '../../../components/shared/Badges';
import { HallazgoCard } from '../../../components/shared/HallazgoCard';
import { useData } from '../../../context/DataContext';
import { etiquetaRequisito } from '../../../components/shared/RequisitoPicker';
import { hallazgoDescripcionEditable } from '../../../domain/auditoriaReglas';
import { HallazgoFormModal } from '../../hallazgos/HallazgoFormModal';
import type { Auditoria } from '../../../types';

export default function HallazgosTab({ a }: { a: Auditoria }) {
  const nav = useNavigate();
  const { hallazgos, mapa } = useData();
  const [nuevo, setNuevo] = useState(false);
  const hs = hallazgos.filter((h) => h.auditoriaId === a.id).sort((x, y) => x.correlativo - y.correlativo);
  const anteriores = a.auditoriaAnteriorId ? hallazgos.filter((h) => h.auditoriaId === a.auditoriaAnteriorId && !h.anulado && h.estado !== 'tratada') : [];
  const editable = hallazgoDescripcionEditable(a.estado);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-zinc-600">
          <b className="text-red-700">{hs.filter((h) => h.tipo === 'NC' && !h.anulado).length} NC</b> · <b className="text-sky-700">{hs.filter((h) => h.tipo === 'OM' && !h.anulado).length} OM</b>
        </p>
        {editable && <Button variant="primary" icon={<Plus className="h-4 w-4" />} onClick={() => setNuevo(true)}>Nuevo hallazgo</Button>}
      </div>

      {hs.length === 0 ? (
        <EmptyState title="Sin hallazgos">Créalos desde el checklist (ítems NC/OM) o con «Nuevo hallazgo».</EmptyState>
      ) : (
        <div className="table-wrap">
          <table className="tabla">
            <thead>
              <tr><th>Id</th><th>NC/OM</th><th>Requisito</th><th>Descripción</th><th>Nivel</th><th>Estado</th><th>Plazo</th></tr>
            </thead>
            <tbody>
              {hs.map((h) => (
                <tr key={h.id} className={'cursor-pointer hover:bg-zinc-50 ' + (h.anulado ? 'opacity-50' : '')} onClick={() => nav(`/hallazgos/${h.id}`)}>
                  <td className="font-bold"><Link to={`/hallazgos/${h.id}`}>{h.correlativo}</Link></td>
                  <td><TipoBadge tipo={h.tipo} /></td>
                  <td className="max-w-48 text-xs">{h.requisitoIds.map((id) => mapa.requisitos[id]).filter(Boolean).map((r) => <div key={r.id} title={etiquetaRequisito(r)}>{r.norma} {r.clausula}</div>)}</td>
                  <td className="max-w-md"><span className="line-clamp-3">{h.descripcion}</span></td>
                  <td><NivelBadge nivel={h.nivel} /></td>
                  <td><EstadoHallazgoBadge estado={h.estado} anulado={h.anulado} /></td>
                  <td><PlazoBadge h={h} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {a.auditoriaAnteriorId && (
        <Card title={`Pendientes de la auditoría anterior ${mapa.auditorias[a.auditoriaAnteriorId]?.codigo ?? ''} (${anteriores.length})`}>
          {anteriores.length === 0 ? (
            <p className="text-sm text-zinc-500">No hay hallazgos abiertos de la auditoría anterior.</p>
          ) : (
            <>
              <p className="mb-3 text-xs text-zinc-500">Verifica su eficacia en esta auditoría desde la hoja «Eficacia» de cada hallazgo (RN-14).</p>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {anteriores.map((h) => <HallazgoCard key={h.id} h={h} />)}
              </div>
            </>
          )}
        </Card>
      )}

      <HallazgoFormModal open={nuevo} onClose={() => setNuevo(false)} auditoria={a} onCreado={(id) => nav(`/hallazgos/${id}`)} />
    </div>
  );
}
