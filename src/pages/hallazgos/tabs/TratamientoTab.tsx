import { useEffect, useState } from 'react';
import { Pencil, Plus, Save, Trash2 } from 'lucide-react';
import { Alerta, Button, Card, ErrorList, Field, Input, Modal, Textarea } from '../../../components/ui';
import { MotivoModal } from '../../../components/shared/MotivoModal';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { fmtFecha, fmtFechaHora, hoyISO } from '../../../lib/dates';
import { errorMensaje } from '../../../lib/utils';
import { advertenciasTratamiento, plazoEfectivo, requiereNuevaAccion, validarAccion } from '../../../domain/hallazgoReglas';
import { esGestor } from '../../../domain/permisos';
import { cerrarOMSinAccion, eliminarAccion, guardarAccion, guardarTratamiento, reabrirOM } from '../../../services/hallazgos';
import type { Accion, AnalisisCausa, Hallazgo } from '../../../types';

type AccionForm = Omit<Accion, 'id' | 'creadoEn' | 'creadoPor'> & { id?: string };

export default function TratamientoTab({ h, editable }: { h: Hallazgo; editable: boolean }) {
  const u = useUsuario();
  const notify = useToast();
  const [correccion, setCorreccion] = useState(h.correccion);
  const [causa, setCausa] = useState<AnalisisCausa>(h.analisisCausa);
  const [dirty, setDirty] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const [accion, setAccion] = useState<AccionForm | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [cerrarOM, setCerrarOM] = useState(false);

  useEffect(() => {
    if (!dirty) {
      setCorreccion(h.correccion);
      setCausa(h.analisisCausa);
    }
  }, [h.correccion, h.analisisCausa, dirty]);

  const faltantes = advertenciasTratamiento({ ...h, correccion, analisisCausa: causa });
  const nc = h.tipo === 'NC';

  async function guardarBase() {
    setGuardando(true);
    try {
      await guardarTratamiento(u, h.id, correccion.trim(), { ...causa, causaRaiz: causa.causaRaiz.trim() });
      setDirty(false);
      notify('Tratamiento guardado');
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setGuardando(false);
    }
  }

  async function guardarAccionForm() {
    if (!accion) return;
    const e = validarAccion(accion);
    setErrores(e);
    if (e.length) return;
    try {
      await guardarAccion(u, h.id, { ...accion, fechaImplementacion: accion.implementada ? accion.fechaImplementacion : null });
      notify(accion.id ? 'Acción actualizada' : 'Acción agregada');
      setAccion(null);
    } catch (err) {
      setErrores([errorMensaje(err)]);
    }
  }

  const nuevaAccion = (): AccionForm => ({ tipo: nc ? 'correctiva' : 'mejora', descripcion: '', responsable: '', fechaCompromiso: plazoEfectivo(h) ?? hoyISO(), fechaImplementacion: null, implementada: false });

  return (
    <div className="space-y-4">
      {requiereNuevaAccion(h) && <Alerta tipo="error">La última verificación fue <b>NO EFICAZ</b>: registra una nueva acción correctiva (RN-07).</Alerta>}

      {h.tipo === 'OM' && h.cierreSinAccion && (
        <Alerta tipo="info">
          OM cerrada sin acción por {h.cierreSinAccion.usuarioNombre} ({fmtFechaHora(h.cierreSinAccion.fecha)}): {h.cierreSinAccion.motivo}
          {editable && esGestor(u.rol) && (
            <Button size="sm" className="ml-2" onClick={() => reabrirOM(u, h.id).then(() => notify('OM reabierta')).catch((e) => notify(errorMensaje(e), 'error'))}>Reabrir</Button>
          )}
        </Alerta>
      )}

      <Card
        title={nc ? '1 · Respuesta del área' : 'Respuesta del área (opcional para OM)'}
        actions={editable && dirty && <Button size="sm" variant="primary" icon={<Save className="h-3.5 w-3.5" />} loading={guardando} onClick={guardarBase}>Guardar</Button>}
      >
        <div className="grid gap-4 lg:grid-cols-2">
          <Field label="Corrección del hallazgo" hint="Cómo se solucionó la evidencia (acción inmediata).">
            <Textarea rows={5} value={correccion} disabled={!editable} onChange={(e) => { setCorreccion(e.target.value); setDirty(true); }} />
          </Field>
          <Field label="Causa raíz (informada por el área)" hint="El análisis de causa lo realiza el área con su propio método; aquí se registra su conclusión.">
            <Textarea rows={5} value={causa.causaRaiz} disabled={!editable} onChange={(e) => { setCausa({ ...causa, metodo: 'otro', porques: [], causaRaiz: e.target.value }); setDirty(true); }} />
          </Field>
        </div>
      </Card>

      <Card
        title={nc ? '2 · Acciones correctivas (definidas por el área)' : 'Acciones de mejora (opcional, definidas por el área)'}
        actions={
          editable && !(h.tipo === 'OM' && h.cierreSinAccion) && (
            <>
              {h.tipo === 'OM' && !h.acciones.length && esGestor(u.rol) && <Button size="sm" onClick={() => setCerrarOM(true)}>Cerrar OM sin acción</Button>}
              <Button size="sm" variant="primary" icon={<Plus className="h-3 w-3" />} disabled={dirty} onClick={() => { setErrores([]); setAccion(nuevaAccion()); }}>
                Agregar acción
              </Button>
            </>
          )
        }
      >
        <p className="mb-3 text-xs text-zinc-500">Se registran tal como las informa el gerente o encargado del área. <b>No requieren aprobación del auditor</b>: la auditoría solo verifica su eficacia más adelante.</p>
        {editable && nc && faltantes.length > 0 && <div className="mb-3"><Alerta tipo="info">Falta registrar: {faltantes.join(' y ')} (recomendado por ISO 10.2).</Alerta></div>}
        {editable && dirty && <p className="mb-2 text-xs text-amber-700">Guarda la corrección/causa antes de agregar acciones.</p>}
        {h.acciones.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin acciones registradas.</p>
        ) : (
          <div className="table-wrap border-0">
            <table className="tabla">
              <thead><tr><th>Acción</th><th>Responsable</th><th>Fecha compromiso</th><th>Situación informada</th><th /></tr></thead>
              <tbody>
                {h.acciones.map((ac) => (
                  <tr key={ac.id}>
                    <td className="max-w-md whitespace-pre-line">{ac.descripcion}</td>
                    <td>{ac.responsable}</td>
                    <td className="whitespace-nowrap">{fmtFecha(ac.fechaCompromiso)}</td>
                    <td className="whitespace-nowrap">{ac.implementada ? <span className="font-semibold text-emerald-700">✓ Implementada {fmtFecha(ac.fechaImplementacion)}</span> : <span className="text-zinc-600">Comprometida por el área</span>}</td>
                    <td className="whitespace-nowrap text-right">
                      {editable && (
                        <>
                          <button aria-label="Editar" className="p-1.5 text-zinc-500 hover:text-zinc-900" onClick={() => { setErrores([]); setAccion({ ...ac }); }}><Pencil className="h-4 w-4" /></button>
                          {!h.verificaciones.length && (
                            <button aria-label="Eliminar" className="p-1.5 text-zinc-400 hover:text-red-600" onClick={() => confirm('¿Eliminar la acción?') && eliminarAccion(u, h.id, ac.id).catch((e) => notify(errorMensaje(e), 'error'))}><Trash2 className="h-4 w-4" /></button>
                          )}
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Modal
        open={!!accion}
        onClose={() => setAccion(null)}
        title={accion?.id ? 'Editar acción' : 'Nueva acción'}
        footer={<><Button onClick={() => setAccion(null)}>Cancelar</Button><Button variant="primary" icon={<Save className="h-4 w-4" />} onClick={guardarAccionForm}>Guardar</Button></>}
      >
        {accion && (
          <div className="space-y-3">
            <Field label={nc ? 'Acción correctiva (definitiva)' : 'Acción de mejora'}>
              <Textarea rows={4} value={accion.descripcion} onChange={(e) => setAccion({ ...accion, descripcion: e.target.value })} autoFocus />
            </Field>
            <Field label="Responsable (nombre y cargo)">
              <Input value={accion.responsable} onChange={(e) => setAccion({ ...accion, responsable: e.target.value })} />
            </Field>
            <Field label="Fecha de compromiso">
              <Input type="date" value={accion.fechaCompromiso} onChange={(e) => setAccion({ ...accion, fechaCompromiso: e.target.value })} />
            </Field>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" className="accent-panel" checked={accion.implementada} onChange={(e) => setAccion({ ...accion, implementada: e.target.checked, fechaImplementacion: e.target.checked ? accion.fechaImplementacion ?? hoyISO() : null })} />
              El área informa que ya está implementada
            </label>
            {accion.implementada && (
              <Field label="Fecha de implementación">
                <Input type="date" value={accion.fechaImplementacion ?? ''} onChange={(e) => setAccion({ ...accion, fechaImplementacion: e.target.value || null })} />
              </Field>
            )}
            <ErrorList errores={errores} />
          </div>
        )}
      </Modal>

      <MotivoModal
        open={cerrarOM}
        titulo="Cerrar OM sin acción"
        variante="primary"
        confirmar="Cerrar OM"
        descripcion="La OM quedará tratada sin implementar acciones. Justifica la decisión."
        onClose={() => setCerrarOM(false)}
        onConfirm={async (m) => {
          try {
            await cerrarOMSinAccion(u, h.id, m);
            notify('OM cerrada');
            setCerrarOM(false);
          } catch (e) {
            notify(errorMensaje(e), 'error');
          }
        }}
      />
    </div>
  );
}
