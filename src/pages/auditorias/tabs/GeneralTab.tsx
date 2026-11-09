import { useEffect, useState, type ReactNode } from 'react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import { Alerta, Button, Card, ErrorList, Input, Select } from '../../../components/ui';
import { MotivoModal } from '../../../components/shared/MotivoModal';
import { useData } from '../../../context/DataContext';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { NORMA_VERSION } from '../../../lib/constants';
import { fmtFecha, fmtFechaHora } from '../../../lib/dates';
import { errorMensaje } from '../../../lib/utils';
import { transicionesDisponibles, validarEnvioRevision, type Transicion } from '../../../domain/auditoriaReglas';
import { esGestor } from '../../../domain/permisos';
import { cambiarEstadoAuditoria, guardarAgenda } from '../../../services/auditorias';
import { AuditoriaFormModal } from '../AuditoriaFormModal';
import type { AgendaItem, Auditoria, ChecklistItem } from '../../../types';

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-xs font-semibold uppercase tracking-wide text-zinc-500">{label}</dt>
      <dd className="mt-0.5 whitespace-pre-line text-sm text-zinc-900">{children || '—'}</dd>
    </div>
  );
}

export default function GeneralTab({ a, checklist }: { a: Auditoria; checklist: ChecklistItem[] }) {
  const u = useUsuario();
  const notify = useToast();
  const { mapa, auditores } = useData();
  const [editar, setEditar] = useState(false);
  const [trans, setTrans] = useState<Transicion | null>(null);
  const [errores, setErrores] = useState<string[]>([]);
  const [agenda, setAgenda] = useState<AgendaItem[]>(a.agenda ?? []);
  const [agendaDirty, setAgendaDirty] = useState(false);
  const gestor = esGestor(u.rol);

  useEffect(() => {
    if (!agendaDirty) setAgenda(a.agenda ?? []);
  }, [a.agenda, agendaDirty]);

  async function ejecutar(t: Transicion, motivo?: string) {
    setErrores([]);
    if (t.hacia === 'en_revision' && a.estado === 'en_ejecucion') {
      const e = validarEnvioRevision(checklist);
      if (e.length) return setErrores(e);
    }
    try {
      await cambiarEstadoAuditoria(u, a, t.hacia, motivo);
      notify(`Auditoría: ${t.etiqueta.toLowerCase()}`);
      setTrans(null);
    } catch (err) {
      notify(errorMensaje(err), 'error');
    }
  }

  const setItem = (i: number, k: keyof AgendaItem, v: string) => {
    setAgenda((ag) => ag.map((x, j) => (j === i ? { ...x, [k]: v || (k === 'auditorId' ? null : '') } : x)));
    setAgendaDirty(true);
  };

  return (
    <div className="space-y-4">
      {a.estado === 'anulada' && a.anulacion && (
        <Alerta tipo="error">
          Anulada por {a.anulacion.usuarioNombre} el {fmtFechaHora(a.anulacion.fecha)}. Motivo: {a.anulacion.motivo}
        </Alerta>
      )}
      {a.independenciaForzada && (
        <Alerta tipo="warn">
          Independencia forzada por {a.independenciaForzada.usuarioNombre}: {a.independenciaForzada.motivo}
        </Alerta>
      )}

      {gestor && (
        <div className="flex flex-wrap gap-2">
          {a.estado !== 'anulada' && a.estado !== 'cerrada' && (
            <Button icon={<Pencil className="h-4 w-4" />} onClick={() => setEditar(true)}>
              Editar datos
            </Button>
          )}
          {transicionesDisponibles(a.estado, u.rol).map((t) => (
            <Button key={t.hacia + t.etiqueta} variant={t.variante === 'danger' ? 'danger' : t.variante === 'primary' ? 'primary' : 'secondary'} onClick={() => (t.requiereMotivo ? setTrans(t) : ejecutar(t))}>
              {t.etiqueta}
            </Button>
          ))}
          {a.estado === 'en_revision' && <span className="self-center text-xs text-zinc-500">Para cerrar: emite el informe en la hoja «Informe».</span>}
        </div>
      )}
      <ErrorList errores={errores} />

      <Card title="Datos de la auditoría">
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <Dato label="N° auditoría">{a.codigo}</Dato>
          <Dato label="Sucursal">{mapa.sucursales[a.sucursalId]?.nombre}</Dato>
          <Dato label="Área auditada">{mapa.areas[a.areaId]?.nombre}</Dato>
          <Dato label="Fecha planificada">{fmtFecha(a.fechaPlanificada)}</Dato>
          <Dato label="Fecha de realización">{fmtFecha(a.fechaRealizacion)}</Dato>
          <Dato label="Auditado (jefe/encargado)">{a.auditadosTexto}</Dato>
          <Dato label="Auditor líder">{mapa.auditores[a.auditorLiderId]?.nombre}</Dato>
          <Dato label="Equipo auditor">{a.equipoIds.map((id) => mapa.auditores[id]?.nombre).filter(Boolean).join(', ')}</Dato>
          <Dato label="Normas">{a.normas.map((n) => NORMA_VERSION[n]).join(' · ')}</Dato>
          <div className="sm:col-span-2 lg:col-span-3"><Dato label="Objetivos">{a.objetivos}</Dato></div>
          <div className="sm:col-span-2 lg:col-span-3"><Dato label="Alcance">{a.alcance}</Dato></div>
          {a.auditoriaAnteriorId && <Dato label="Auditoría anterior">{mapa.auditorias[a.auditoriaAnteriorId]?.codigo ?? '(sin acceso)'}</Dato>}
        </dl>
      </Card>

      <Card
        title="Agenda / plan de auditoría"
        actions={
          gestor && a.estado !== 'anulada' && a.estado !== 'cerrada' && (
            <>
              <Button size="sm" icon={<Plus className="h-3 w-3" />} onClick={() => { setAgenda((ag) => [...ag, { fecha: a.fechaPlanificada, hora: '09:00', proceso: '', auditado: '', auditorId: null }]); setAgendaDirty(true); }}>
                Agregar bloque
              </Button>
              {agendaDirty && (
                <Button size="sm" variant="primary" onClick={async () => { try { await guardarAgenda(a, agenda); setAgendaDirty(false); notify('Agenda guardada'); } catch (e) { notify(errorMensaje(e), 'error'); } }}>
                  Guardar agenda
                </Button>
              )}
            </>
          )
        }
      >
        {agenda.length === 0 ? (
          <p className="text-sm text-zinc-500">Sin bloques de agenda.</p>
        ) : (
          <div className="table-wrap border-0">
            <table className="tabla">
              <thead>
                <tr><th>Fecha</th><th>Hora</th><th>Proceso / requisito</th><th>Auditado</th><th>Auditor</th><th /></tr>
              </thead>
              <tbody>
                {agenda.map((it, i) => {
                  const ro = !gestor || a.estado === 'cerrada' || a.estado === 'anulada';
                  return (
                    <tr key={i}>
                      <td><Input type="date" value={it.fecha} disabled={ro} onChange={(e) => setItem(i, 'fecha', e.target.value)} /></td>
                      <td><Input type="time" value={it.hora} disabled={ro} onChange={(e) => setItem(i, 'hora', e.target.value)} /></td>
                      <td><Input value={it.proceso} disabled={ro} onChange={(e) => setItem(i, 'proceso', e.target.value)} /></td>
                      <td><Input value={it.auditado} disabled={ro} onChange={(e) => setItem(i, 'auditado', e.target.value)} /></td>
                      <td>
                        <Select value={it.auditorId ?? ''} disabled={ro} onChange={(e) => setItem(i, 'auditorId', e.target.value)} placeholder="—" options={auditores.filter((x) => a.participantes.includes(x.id)).map((x) => ({ value: x.id, label: x.nombre }))} />
                      </td>
                      <td>
                        {!ro && (
                          <button aria-label="Quitar" className="p-2 text-zinc-400 hover:text-red-600" onClick={() => { setAgenda((ag) => ag.filter((_, j) => j !== i)); setAgendaDirty(true); }}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {(a.reaperturas ?? []).length > 0 && (
        <Card title="Reaperturas">
          <ul className="space-y-1 text-sm">
            {a.reaperturas.map((r) => (
              <li key={r.fecha}>{fmtFechaHora(r.fecha)} · {r.usuarioNombre}: {r.motivo}</li>
            ))}
          </ul>
        </Card>
      )}

      <AuditoriaFormModal open={editar} onClose={() => setEditar(false)} auditoria={a} />
      <MotivoModal open={!!trans} titulo={trans?.etiqueta ?? ''} descripcion={trans?.hacia === 'anulada' ? 'La auditoría conserva su número pero queda anulada.' : 'La auditoría vuelve a revisión y podrá emitirse una nueva versión del informe.'} onClose={() => setTrans(null)} onConfirm={(m) => ejecutar(trans!, m)} />
    </div>
  );
}
