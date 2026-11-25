import { useEffect, useState } from 'react';
import { MessageSquarePlus, Send } from 'lucide-react';
import { Button, Modal, Textarea } from '../ui';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { errorMensaje } from '../../lib/utils';
import { dispositivo, erroresRecientes, rutaGenerica, ultimaAccionUsuario } from '../../lib/errores';
import { enviarReporte } from '../../services/soporte';

/** Formulario global "Reportar problema" (se abre con abrirReporte() desde el menú, un aviso de error o la pantalla de error). */
export function ReportarProblema() {
  const u = useUsuario();
  const notify = useToast();
  const [open, setOpen] = useState(false);
  const [texto, setTexto] = useState('');
  const [origen, setOrigen] = useState('');
  // Lo que hacía el usuario antes de abrir el formulario (después, el último clic sería "Enviar")
  const [accion, setAccion] = useState('');
  const [enviando, setEnviando] = useState(false);

  useEffect(() => {
    const abrir = (e: Event) => {
      setOrigen(String((e as CustomEvent).detail ?? ''));
      setAccion(ultimaAccionUsuario());
      setTexto('');
      setOpen(true);
    };
    window.addEventListener('fma:reportar', abrir);
    return () => window.removeEventListener('fma:reportar', abrir);
  }, []);

  const recientes = open ? erroresRecientes() : [];
  return (
    <Modal
      open={open}
      onClose={() => !enviando && setOpen(false)}
      title={<span className="flex items-center gap-2"><MessageSquarePlus className="h-5 w-5" /> Reportar un problema</span>}
      footer={
        <>
          <Button onClick={() => setOpen(false)} disabled={enviando}>Cancelar</Button>
          <Button
            variant="primary"
            icon={<Send className="h-4 w-4" />}
            loading={enviando}
            disabled={texto.trim().length < 5}
            onClick={async () => {
              setEnviando(true);
              try {
                await enviarReporte(u, origen ? `${texto}\n\n[Aviso mostrado: ${origen}]` : texto, accion);
                notify('Gracias. El reporte le llegó al administrador.');
                setOpen(false);
              } catch (e) {
                notify(errorMensaje(e), 'error');
              } finally {
                setEnviando(false);
              }
            }}
          >
            Enviar reporte
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        {origen && <p className="rounded-md bg-red-50 px-3 py-2 text-red-800">Aviso: {origen}</p>}
        <label className="block">
          <span className="label">¿Qué estabas haciendo y qué pasó?</span>
          <Textarea rows={4} autoFocus value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Ej.: estaba subiendo una foto al hallazgo #3 de Bodega y la app se quedó cargando." />
        </label>
        <div className="rounded-md bg-zinc-50 px-3 py-2 text-xs text-zinc-600">
          <p className="font-semibold text-zinc-700">Se adjunta automáticamente:</p>
          <p>Pantalla {rutaGenerica()} · {dispositivo()}{recientes.length ? ` · ${recientes.length} error(es) reciente(s)` : ''}</p>
          <p className="mt-1 text-zinc-500">No se envían contraseñas ni el contenido de los hallazgos.</p>
        </div>
      </div>
    </Modal>
  );
}
