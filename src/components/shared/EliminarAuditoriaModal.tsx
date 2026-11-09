import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { Alerta, Button, Input, Modal } from '../ui';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { eliminarAuditoria } from '../../services/auditorias';
import type { Auditoria } from '../../types';

/**
 * Confirmación para eliminar una auditoría (solo auditor líder).
 * Con informe emitido exige escribir el N° de la auditoría: borra también los informes y no se puede deshacer.
 */
export function EliminarAuditoriaModal({ auditoria: a, open, onClose, onEliminada, nHallazgos, detalle }: {
  auditoria: Auditoria | null;
  open: boolean;
  onClose: () => void;
  onEliminada?: () => void;
  nHallazgos: number;
  detalle?: string;
}) {
  const u = useUsuario();
  const notify = useToast();
  const [texto, setTexto] = useState('');
  const [borrando, setBorrando] = useState(false);
  useEffect(() => { if (open) setTexto(''); }, [open]);
  if (!a) return null;
  const conInforme = a.informeVersion > 0;
  const confirmado = !conInforme || texto.trim() === a.codigo;

  return (
    <Modal
      open={open}
      onClose={() => !borrando && onClose()}
      title={`Eliminar auditoría ${a.codigo}`}
      footer={
        <>
          <Button onClick={onClose} disabled={borrando}>Cancelar</Button>
          <Button
            variant="danger"
            icon={<Trash2 className="h-4 w-4" />}
            loading={borrando}
            disabled={!confirmado}
            onClick={async () => {
              setBorrando(true);
              try {
                await eliminarAuditoria(u, a);
                notify(`Auditoría ${a.codigo} eliminada`);
                onClose();
                onEliminada?.();
              } catch (err) {
                notify(errorMensaje(err), 'error');
              } finally {
                setBorrando(false);
              }
            }}
          >
            Eliminar definitivamente
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {detalle && <p className="text-zinc-600">{detalle}</p>}
        <Alerta tipo="error">
          Se borrarán la auditoría, sus <b>{nHallazgos} hallazgo(s)</b>, todas sus fotos{conInforme ? <> y sus <b>{a.informeVersion} versión(es) de informe emitido</b></> : ''}. <b>No se puede deshacer.</b>
        </Alerta>
        {conInforme ? (
          <>
            <Alerta tipo="warn">
              Esta auditoría está <b>{a.estado === 'cerrada' ? 'cerrada' : a.estado}</b> y tiene informe emitido. Si fue real y se informó a un área, lo correcto es <b>Anular</b> (conserva la trazabilidad ante una auditoría externa). Elimina solo auditorías de prueba o creadas por error.
            </Alerta>
            <label className="block">
              <span className="label">Para confirmar, escribe el N° de la auditoría: <b className="normal-case text-zinc-900">{a.codigo}</b></span>
              <Input value={texto} onChange={(e) => setTexto(e.target.value)} placeholder={a.codigo} autoFocus />
            </label>
          </>
        ) : (
          <p className="text-zinc-600">El número <b>{a.codigo}</b> no se reutiliza. Si la auditoría ya tuvo validez, es preferible <b>Anular</b>.</p>
        )}
        <p className="text-xs text-zinc-500">La eliminación queda registrada en la bitácora del sistema.</p>
      </div>
    </Modal>
  );
}
