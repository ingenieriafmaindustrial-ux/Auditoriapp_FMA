import { useRef, useState } from 'react';
import { Camera, Save, Trash2 } from 'lucide-react';
import { Button, Modal, Spinner, Textarea } from '../ui';
import { useUsuario } from '../../context/AuthContext';
import { useToast } from '../../context/ToastContext';
import { evidenceStore } from '../../services/evidencias';
import { errorMensaje } from '../../lib/utils';
import { esGestor } from '../../domain/permisos';
import type { Auditoria, Evidencia } from '../../types';

export function EvidenciasPanel({ auditoria, evidencias, hallazgoId = null, checklistItemId = null, editable, compacto }: {
  auditoria: Auditoria;
  evidencias: Evidencia[];
  hallazgoId?: string | null;
  checklistItemId?: string | null;
  editable: boolean;
  compacto?: boolean;
}) {
  const u = useUsuario();
  const notify = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [subiendo, setSubiendo] = useState(0);
  const [ver, setVer] = useState<Evidencia | null>(null);
  const [imagen, setImagen] = useState<string | null>(null);
  const [desc, setDesc] = useState('');

  async function onFiles(files: FileList | null) {
    if (!files?.length) return;
    const lista = Array.from(files);
    setSubiendo(lista.length);
    let original = 0;
    let final = 0;
    for (const f of lista) {
      try {
        const r = await evidenceStore.subir(u, f, { auditoriaId: auditoria.id, participantes: auditoria.participantes, hallazgoId, checklistItemId, descripcion: '' });
        original += r.original;
        final += r.bytes;
      } catch (e) {
        notify(errorMensaje(e), 'error');
      } finally {
        setSubiendo((n) => n - 1);
      }
    }
    if (input.current) input.current.value = '';
    if (final > 0) {
      const kb = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.round(b / 1024)} KB`);
      notify(`Foto(s) guardada(s): ${kb(original)} → ${kb(final)} (${Math.round((1 - final / original) * 100)}% menos)`);
    }
  }

  async function abrir(ev: Evidencia) {
    setVer(ev);
    setDesc(ev.descripcion);
    setImagen(null);
    setImagen((await evidenceStore.obtenerImagen(ev.id)) ?? ev.miniatura);
  }

  const puedeBorrar = (ev: Evidencia) => editable && (esGestor(u.rol) || ev.subidoPor === u.id);

  return (
    <div>
      <div className={compacto ? 'flex flex-wrap gap-2' : 'grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-6'}>
        {evidencias.map((ev) => (
          <button key={ev.id} type="button" onClick={() => abrir(ev)} className={compacto ? 'h-14 w-14 overflow-hidden rounded-md border' : 'aspect-square overflow-hidden rounded-lg border bg-zinc-50'} title={ev.descripcion || 'Ver evidencia'}>
            <img src={ev.miniatura} alt={ev.descripcion || 'Evidencia'} className="h-full w-full object-cover" loading="lazy" />
          </button>
        ))}
        {editable && (
          <button
            type="button"
            onClick={() => input.current?.click()}
            disabled={subiendo > 0}
            className={
              (compacto ? 'h-14 w-14 ' : 'aspect-square ') +
              'flex flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-zinc-300 text-xs text-zinc-500 hover:border-zinc-500 hover:text-zinc-800 disabled:opacity-60'
            }
          >
            <Camera className="h-5 w-5" />
            {!compacto && (subiendo > 0 ? `Subiendo ${subiendo}…` : 'Agregar foto')}
          </button>
        )}
      </div>
      <input ref={input} type="file" accept="image/*" capture="environment" multiple hidden onChange={(e) => onFiles(e.target.files)} />

      <Modal
        open={!!ver}
        onClose={() => setVer(null)}
        size="xl"
        title="Evidencia fotográfica"
        footer={
          ver && (
            <>
              {puedeBorrar(ver) && (
                <Button
                  variant="danger"
                  icon={<Trash2 className="h-4 w-4" />}
                  onClick={async () => {
                    if (!confirm('¿Eliminar esta evidencia?')) return;
                    try {
                      await evidenceStore.eliminar(u, ver);
                      setVer(null);
                      notify('Evidencia eliminada');
                    } catch (e) {
                      notify(errorMensaje(e), 'error');
                    }
                  }}
                >
                  Eliminar
                </Button>
              )}
              {editable && (
                <Button
                  variant="primary"
                  icon={<Save className="h-4 w-4" />}
                  onClick={async () => {
                    try {
                      await evidenceStore.actualizarDescripcion(ver.id, desc.trim());
                      notify('Descripción guardada');
                      setVer(null);
                    } catch (e) {
                      notify(errorMensaje(e), 'error');
                    }
                  }}
                >
                  Guardar descripción
                </Button>
              )}
            </>
          )
        }
      >
        {imagen ? <img src={imagen} alt="" className="mx-auto max-h-[60vh] rounded-lg" /> : <Spinner />}
        <div className="mt-3">
          <span className="label">Descripción (aparece en el informe)</span>
          <Textarea value={desc} onChange={(e) => setDesc(e.target.value)} disabled={!editable} rows={2} />
        </div>
      </Modal>
    </div>
  );
}
