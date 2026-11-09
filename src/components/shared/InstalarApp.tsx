import { useState } from 'react';
import { MonitorDown, Share, SquarePlus } from 'lucide-react';
import { Button, Modal } from '../ui';
import { useInstalacion } from '../../lib/pwa';
import { useToast } from '../../context/ToastContext';

/** Botón "Instalar app": en PC y Android abre el instalador del navegador; en iPhone muestra cómo hacerlo. */
export function InstalarApp() {
  const { estado, instalar } = useInstalacion();
  const notify = useToast();
  const [ayudaIOS, setAyudaIOS] = useState(false);
  if (estado === 'instalada' || estado === 'no_disponible') return null;

  const onClick = async () => {
    if (estado === 'ios') return setAyudaIOS(true);
    if (await instalar()) notify('App instalada: la encontrará en el escritorio y en el menú Inicio');
  };

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        title="Instalar la app en este equipo"
        className="flex items-center gap-1.5 rounded-full border border-brand/60 px-2.5 py-1.5 text-xs font-bold uppercase tracking-wide text-brand transition-colors hover:bg-brand hover:text-ink"
      >
        <MonitorDown className="h-4 w-4" />
        <span className="hidden md:inline">Instalar app</span>
      </button>
      <Modal open={ayudaIOS} onClose={() => setAyudaIOS(false)} title="Instalar en iPhone o iPad" footer={<Button variant="primary" onClick={() => setAyudaIOS(false)}>Entendido</Button>}>
        <ol className="space-y-3 text-sm text-zinc-700">
          <li className="flex items-start gap-2"><b>1.</b> Abra la app en <b>Safari</b>.</li>
          <li className="flex items-start gap-2"><b>2.</b> Toque el botón <Share className="mx-0.5 inline h-4 w-4" /> <b>Compartir</b>.</li>
          <li className="flex items-start gap-2"><b>3.</b> Elija <SquarePlus className="mx-0.5 inline h-4 w-4" /> <b>Agregar a pantalla de inicio</b> y confirme.</li>
        </ol>
      </Modal>
    </>
  );
}
