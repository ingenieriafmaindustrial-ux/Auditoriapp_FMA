import { Spinner } from '../../../components/ui';
import { useBitacora } from '../../../hooks/useAuditoriaData';
import { fmtFechaHora } from '../../../lib/dates';
import type { Auditoria } from '../../../types';

const etiqueta: Record<string, string> = {
  crear: 'Creación',
  editar: 'Edición',
  cambio_estado: 'Cambio de estado',
  emitir_informe: 'Informe',
  anular: 'Anulación',
  reabrir: 'Reapertura',
  eliminar: 'Eliminación',
};

export default function BitacoraTab({ a }: { a: Auditoria }) {
  const { data, loading } = useBitacora(a.id);
  if (loading) return <Spinner />;
  if (!data.length) return <p className="text-sm text-zinc-500">Sin registros.</p>;
  return (
    <div className="table-wrap">
      <table className="tabla">
        <thead><tr><th>Fecha</th><th>Usuario</th><th>Entidad</th><th>Acción</th><th>Detalle</th></tr></thead>
        <tbody>
          {data.map((b) => (
            <tr key={b.id}>
              <td className="whitespace-nowrap text-xs">{fmtFechaHora(b.fecha)}</td>
              <td className="whitespace-nowrap">{b.usuarioNombre}</td>
              <td className="capitalize">{b.entidad}</td>
              <td className="whitespace-nowrap">{etiqueta[b.accion] ?? b.accion}</td>
              <td>{b.detalle}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
