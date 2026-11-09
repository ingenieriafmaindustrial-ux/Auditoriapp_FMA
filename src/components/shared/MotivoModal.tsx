import { useState } from 'react';
import { Button, Field, Modal, Textarea } from '../ui';

export function MotivoModal({ open, titulo, descripcion, confirmar = 'Confirmar', variante = 'danger', onClose, onConfirm }: {
  open: boolean;
  titulo: string;
  descripcion?: string;
  confirmar?: string;
  variante?: 'danger' | 'primary';
  onClose: () => void;
  onConfirm: (motivo: string) => Promise<void>;
}) {
  const [motivo, setMotivo] = useState('');
  const [loading, setLoading] = useState(false);
  const ok = motivo.trim().length >= 5;
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={titulo}
      footer={
        <>
          <Button onClick={onClose}>Cancelar</Button>
          <Button
            variant={variante}
            disabled={!ok}
            loading={loading}
            onClick={async () => {
              setLoading(true);
              try {
                await onConfirm(motivo.trim());
                setMotivo('');
              } finally {
                setLoading(false);
              }
            }}
          >
            {confirmar}
          </Button>
        </>
      }
    >
      {descripcion && <p className="mb-3 text-sm text-zinc-600">{descripcion}</p>}
      <Field label="Motivo (queda en la bitácora)">
        <Textarea value={motivo} onChange={(e) => setMotivo(e.target.value)} autoFocus />
      </Field>
    </Modal>
  );
}
