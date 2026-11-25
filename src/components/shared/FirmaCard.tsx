import { useRef, useState } from 'react';
import { PenLine, Trash2, Upload } from 'lucide-react';
import { Alerta, Button, Card } from '../ui';
import { useUsuario } from '../../context/AuthContext';
import { useData } from '../../context/DataContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { procesarFirma, type Firma } from '../../lib/firmas';
import { eliminarMiFirma, guardarMiFirma } from '../../services/firmas';
import { fmtFechaHora } from '../../lib/dates';

/** Firma digitalizada del usuario: se estampa en los documentos que aprueba como auditor líder o que elabora/aprueba. */
export function FirmaCard() {
  const u = useUsuario();
  const { firmas } = useData();
  const notify = useToast();
  const actual = firmas.find((f) => f.id === u.id);
  const [nueva, setNueva] = useState<Firma | null>(null);
  const [trabajando, setTrabajando] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  const mostrar = nueva ?? actual ?? null;

  const elegir = async (file: File | undefined) => {
    if (!file) return;
    try {
      setNueva(await procesarFirma(file));
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      if (input.current) input.current.value = '';
    }
  };

  return (
    <Card title={<span className="flex items-center gap-2"><PenLine className="h-4 w-4" /> Mi firma</span>}>
      <p className="text-sm text-zinc-600">
        Se inserta en el informe Word (portada y aprobación) cuando apruebas como auditor líder, en el plan de auditoría y en los PDF donde figures como "Elaborado por" o "Aprobado por".
        Queda guardada en la base de datos y solo la ven usuarios con sesión iniciada.
      </p>
      <div className="mt-3 flex min-h-28 items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white p-3">
        {mostrar ? <img src={mostrar.dataUrl} alt="Firma" className="max-h-24 w-auto" /> : <span className="text-sm text-zinc-500">Sin firma registrada</span>}
      </div>
      {actual && !nueva && <p className="mt-1 text-xs text-zinc-500">Actualizada el {fmtFechaHora(actual.actualizadoEn)} · nombre en documentos: <b>{actual.nombre}</b></p>}
      {actual && actual.nombre !== u.nombre && !nueva && (
        <div className="mt-2"><Alerta tipo="warn">Tu nombre cambió desde que subiste la firma. Vuelve a subirla para que coincida con "{u.nombre}".</Alerta></div>
      )}
      {nueva && <p className="mt-1 text-xs text-zinc-500">Vista previa: fondo transparente y márgenes recortados. Revisa que se vea bien antes de guardar.</p>}
      <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => elegir(e.target.files?.[0])} />
      <div className="mt-3 flex flex-wrap gap-2">
        {nueva ? (
          <>
            <Button
              variant="primary"
              loading={trabajando}
              onClick={async () => {
                setTrabajando(true);
                try {
                  await guardarMiFirma(u, nueva);
                  setNueva(null);
                  notify('Firma guardada');
                } catch (e) {
                  notify(errorMensaje(e), 'error');
                } finally {
                  setTrabajando(false);
                }
              }}
            >
              Guardar firma
            </Button>
            <Button onClick={() => setNueva(null)} disabled={trabajando}>Cancelar</Button>
          </>
        ) : (
          <>
            <Button icon={<Upload className="h-4 w-4" />} onClick={() => input.current?.click()}>{actual ? 'Reemplazar firma' : 'Subir firma'}</Button>
            {actual && (
              <Button
                variant="danger"
                icon={<Trash2 className="h-4 w-4" />}
                loading={trabajando}
                onClick={async () => {
                  if (!window.confirm('¿Eliminar tu firma? Los documentos nuevos saldrán sin firma.')) return;
                  setTrabajando(true);
                  try {
                    await eliminarMiFirma(u);
                    notify('Firma eliminada');
                  } catch (e) {
                    notify(errorMensaje(e), 'error');
                  } finally {
                    setTrabajando(false);
                  }
                }}
              >
                Eliminar
              </Button>
            )}
          </>
        )}
      </div>
    </Card>
  );
}
