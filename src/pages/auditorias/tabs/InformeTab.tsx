import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { CheckCircle2, Download, FileCheck2, Stamp } from 'lucide-react';
import { Alerta, Button, Card, Field, Input, Modal, Textarea } from '../../../components/ui';
import { useData } from '../../../context/DataContext';
import { useUsuario } from '../../../context/AuthContext';
import { useToast } from '../../../context/ToastContext';
import { useEvidencias, useInformes } from '../../../hooks/useAuditoriaData';
import { NORMA_VERSION } from '../../../lib/constants';
import { ahoraISO, fmtFecha, fmtFechaHora } from '../../../lib/dates';
import { errorMensaje } from '../../../lib/utils';
import { construirSnapshot } from '../../../domain/informe';
import { esGestor, puedeEmitirInforme } from '../../../domain/permisos';
import { emitirInforme, guardarAprobaciones, guardarNotas } from '../../../services/auditorias';
import { descargarInformeWord } from '../../../services/informeExport';
import type { Aprobacion, Auditoria, InformeSnapshot } from '../../../types';

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 border-b-2 border-panel pb-1 text-sm font-bold tracking-wide">{titulo}</h3>
      {children}
    </section>
  );
}

/** Vista del informe con la estructura de la plantilla v10/2024. */
function VistaInforme({ s }: { s: InformeSnapshot }) {
  const est: Record<string, string> = { no_tratada: 'No tratada', en_seguimiento: 'En seguimiento', tratada: 'Tratada' };
  return (
    <div className="mx-auto max-w-4xl rounded-lg border border-zinc-300 bg-surface p-4 text-sm sm:p-8">
      <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3 border border-zinc-400 p-2">
        <img src="/logo-fma.png" alt="FMA" className="h-14 w-14" />
        <p className="text-center font-bold">INFORME DE AUDITORÍA INTERNA</p>
        <p className="text-right text-xs">Versión 10 / 2024<br /><span className="text-zinc-500">Informe {s.version ? `v${s.version}` : 'borrador'}</span></p>
      </div>
      <div className="table-wrap mt-4 rounded-none">
        <table className="tabla min-w-0">
          <tbody>
            {([
              ['Auditoría Nº', s.codigo],
              ['Sucursal', s.sucursal],
              ['Objetivos', s.objetivos],
              ['Alcance', s.alcance],
              ['Normas de referencia', s.normas.map((n) => NORMA_VERSION[n]).join(' · ')],
              ['Auditor líder', s.auditorLider],
              ['Equipo auditor', s.equipo.join(', ') || '—'],
              ['Área auditada', s.area],
              ['Fecha de realización', fmtFecha(s.fechaRealizacion)],
              ['N° No Conformidades / Oportunidades de mejora', `${s.totalNC} / ${s.totalOM}`],
            ] as const).map(([k, v]) => (
              <tr key={k}><th className="w-1/3 normal-case">{k}</th><td className="whitespace-pre-line">{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>

      <Seccion titulo="RESULTADOS DE LA AUDITORÍA">
        <div className="table-wrap rounded-none">
          <table className="tabla">
            <thead><tr><th>Id</th><th>NC/OM</th><th>Requisito / Norma</th><th>Descripción del hallazgo</th></tr></thead>
            <tbody>
              {s.hallazgos.map((h) => (
                <tr key={h.correlativo}><td>{h.correlativo}</td><td>{h.tipo}</td><td className="whitespace-pre-line text-xs">{h.requisitos.join('\n')}</td><td className="whitespace-pre-line">{h.descripcion}</td></tr>
              ))}
              {!s.hallazgos.length && <tr><td colSpan={4} className="text-zinc-500">Sin hallazgos.</td></tr>}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="NOTAS"><p className="whitespace-pre-line">{s.notas || '—'}</p></Seccion>

      <Seccion titulo="RESULTADOS DEL SEGUIMIENTO DE AUDITORÍA">
        <div className="table-wrap rounded-none">
          <table className="tabla">
            <thead><tr><th>Id</th><th>NC/OM</th><th>Corrección del hallazgo</th><th>Acción correctiva</th></tr></thead>
            <tbody>
              {s.hallazgos.map((h) => (
                <tr key={h.correlativo}>
                  <td>{h.correlativo}</td><td>{h.tipo}</td>
                  <td className="whitespace-pre-line">{h.correccion || '—'}</td>
                  <td>{h.causaRaiz && <p className="mb-1 text-xs italic">Causa raíz: {h.causaRaiz}</p>}{h.acciones.length ? <ul className="list-inside list-disc">{h.acciones.map((a) => <li key={a}>{a}</li>)}</ul> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="VERIFICACIÓN DE EFICACIA">
        <div className="table-wrap rounded-none">
          <table className="tabla">
            <thead><tr><th>Id</th><th>NC/OM</th><th>Fecha</th><th>Nivel</th><th>Análisis de eficacia</th></tr></thead>
            <tbody>
              {s.hallazgos.map((h) => (
                <tr key={h.correlativo}>
                  <td>{h.correlativo}</td><td>{h.tipo}</td><td className="whitespace-nowrap">{fmtFecha(h.verificacionFecha)}</td><td>{h.nivel}</td>
                  <td>{h.verificacionResultado ? <><b>{h.verificacionResultado === 'eficaz' ? 'EFICAZ' : 'NO EFICAZ'}</b> · <span className="whitespace-pre-line">{h.verificacionAnalisis}</span></> : <i className="text-zinc-500">Pendiente · {est[h.estado]}</i>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="EVIDENCIA FOTOGRÁFICA">
        <p className="text-zinc-600">{s.evidencias.length} fotografía(s) — se insertan en el Word exportado.</p>
      </Seccion>

      <Seccion titulo="APROBACIÓN DEL DOCUMENTO">
        <div className="grid gap-3 sm:grid-cols-3">
          {(['auditor_lider', 'equipo', 'jefe_area'] as const).map((rol) => {
            const aps = s.aprobaciones.filter((x) => x.rol === rol);
            return (
              <div key={rol} className="rounded border border-zinc-300 p-3 text-center">
                <p className="text-xs font-bold uppercase">{{ auditor_lider: 'Auditor líder', equipo: 'Equipo auditor', jefe_area: 'Jefe / encargado de área' }[rol]}</p>
                {aps.length ? aps.map((x) => <p key={x.nombre} className="mt-1 text-emerald-700">✓ {x.nombre}<br /><span className="text-xs text-zinc-500">{fmtFechaHora(x.fecha)}</span></p>) : <p className="mt-1 text-xs text-zinc-400">Pendiente</p>}
              </div>
            );
          })}
        </div>
      </Seccion>
    </div>
  );
}

export default function InformeTab({ a }: { a: Auditoria }) {
  const u = useUsuario();
  const notify = useToast();
  const { hallazgos, mapa } = useData();
  const evid = useEvidencias(a.id);
  const informes = useInformes(a.id);
  const [notas, setNotas] = useState(a.notas);
  const [notasDirty, setNotasDirty] = useState(false);
  const [jefe, setJefe] = useState(a.auditadosTexto);
  const [emitir, setEmitir] = useState(false);
  const [comentario, setComentario] = useState('');
  const [loading, setLoading] = useState('');
  const [verVersion, setVerVersion] = useState<number | null>(null);

  useEffect(() => {
    if (!notasDirty) setNotas(a.notas);
  }, [a.notas, notasDirty]);

  const borrador = useMemo(() => construirSnapshot({ ...a, notas }, hallazgos, evid.data, mapa), [a, notas, hallazgos, evid.data, mapa]);
  const version = verVersion ? informes.data.find((i) => i.version === verVersion) : null;
  const vista = version?.snapshot ?? borrador;

  const soyLider = !!u.auditorId && u.auditorId === a.auditorLiderId;
  const soyEquipo = !!u.auditorId && a.equipoIds.includes(u.auditorId);
  const editableAprob = a.estado !== 'anulada';

  async function aprobar(ap: Aprobacion) {
    const resto = (a.aprobaciones ?? []).filter((x) => !(x.rol === ap.rol && (ap.rol !== 'equipo' || x.usuarioId === ap.usuarioId)));
    try {
      await guardarAprobaciones(a, [...resto, ap]);
      notify('Aprobación registrada');
    } catch (e) {
      notify(errorMensaje(e), 'error');
    }
  }

  async function descargar(s: InformeSnapshot) {
    setLoading('word');
    try {
      await descargarInformeWord(s, evid.data);
    } catch (e) {
      notify(errorMensaje(e), 'error');
    } finally {
      setLoading('');
    }
  }

  const puedeEmitir = puedeEmitirInforme(u, a) && (a.estado === 'en_revision' || a.estado === 'cerrada');

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-3">
        <Card title="Notas del informe" actions={notasDirty && a.estado !== 'anulada' && <Button size="sm" variant="primary" onClick={async () => { try { await guardarNotas(u, a, notas, null); setNotasDirty(false); notify('Notas guardadas'); } catch (e) { notify(errorMensaje(e), 'error'); } }}>Guardar</Button>}>
          <Textarea rows={6} value={notas} disabled={a.estado === 'anulada'} placeholder="Información o situación relevante que desea compartir." onChange={(e) => { setNotas(e.target.value); setNotasDirty(true); }} />
        </Card>

        <Card title="Aprobaciones">
          <div className="space-y-2 text-sm">
            {editableAprob && (soyLider || u.rol === 'auditor_lider') && (
              <Button size="sm" className="w-full" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => aprobar({ rol: 'auditor_lider', nombre: mapa.auditores[a.auditorLiderId]?.nombre ?? u.nombre, usuarioId: u.id, fecha: ahoraISO() })}>
                Aprobar como auditor líder
              </Button>
            )}
            {editableAprob && soyEquipo && (
              <Button size="sm" className="w-full" icon={<CheckCircle2 className="h-4 w-4" />} onClick={() => aprobar({ rol: 'equipo', nombre: mapa.auditores[u.auditorId!]?.nombre ?? u.nombre, usuarioId: u.id, fecha: ahoraISO() })}>
                Aprobar como equipo auditor
              </Button>
            )}
            {editableAprob && esGestor(u.rol) && (
              <div className="rounded-lg border border-zinc-200 p-2">
                <Field label="Visto bueno jefe de área (registrado por auditor)">
                  <Input value={jefe} onChange={(e) => setJefe(e.target.value)} placeholder="Nombre y cargo" />
                </Field>
                <Button size="sm" className="mt-2 w-full" disabled={jefe.trim().length < 3} onClick={() => aprobar({ rol: 'jefe_area', nombre: jefe.trim(), usuarioId: null, fecha: ahoraISO() })}>
                  Registrar visto bueno
                </Button>
              </div>
            )}
            <p className="text-xs text-zinc-500">La firma física del jefe de área se estampa sobre el Word/PDF impreso.</p>
          </div>
        </Card>

        <Card title="Emisión y versiones">
          <div className="space-y-2">
            {a.estado === 'en_ejecucion' || a.estado === 'planificada' ? (
              <Alerta tipo="info">Envía la auditoría a revisión para poder emitir el informe.</Alerta>
            ) : null}
            {puedeEmitir && (
              <Button variant="primary" className="w-full" icon={<Stamp className="h-4 w-4" />} onClick={() => setEmitir(true)}>
                {a.informeVersion ? `Emitir versión ${a.informeVersion + 1}` : 'Emitir informe v1 y cerrar'}
              </Button>
            )}
            <Button variant="dark" className="w-full" loading={loading === 'word' && !version} icon={<Download className="h-4 w-4" />} onClick={() => descargar(borrador)}>
              Word (borrador actual)
            </Button>
            <ul className="divide-y divide-zinc-100 text-sm">
              {informes.data.map((inf) => (
                <li key={inf.id} className="flex items-center gap-2 py-2">
                  <FileCheck2 className="h-4 w-4 text-emerald-600" />
                  <button className="flex-1 text-left" onClick={() => setVerVersion(verVersion === inf.version ? null : inf.version)}>
                    <b>v{inf.version}</b> <span className="text-xs text-zinc-500">{fmtFechaHora(inf.emitidoEn)} · {inf.emitidoPorNombre}</span>
                    {inf.comentario && <span className="block text-xs text-zinc-500">{inf.comentario}</span>}
                  </button>
                  <Button size="sm" loading={loading === 'word' && verVersion === inf.version} onClick={() => descargar(inf.snapshot)} icon={<Download className="h-3 w-3" />}>.docx</Button>
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      {version && (
        <Alerta tipo="info">
          Viendo la versión emitida v{version.version} (inmutable). <button className="font-semibold underline" onClick={() => setVerVersion(null)}>Volver al borrador</button>
        </Alerta>
      )}
      <VistaInforme s={vista} />

      <Modal
        open={emitir}
        onClose={() => setEmitir(false)}
        title="Emitir informe"
        footer={
          <>
            <Button onClick={() => setEmitir(false)}>Cancelar</Button>
            <Button
              variant="primary"
              loading={loading === 'emitir'}
              onClick={async () => {
                setLoading('emitir');
                try {
                  if (notasDirty) {
                    await guardarNotas(u, a, notas, null);
                    setNotasDirty(false);
                  }
                  const v = await emitirInforme(u, a, borrador, comentario.trim());
                  notify(`Informe v${v} emitido`);
                  setEmitir(false);
                  setComentario('');
                } catch (e) {
                  notify(errorMensaje(e), 'error');
                } finally {
                  setLoading('');
                }
              }}
            >
              Emitir
            </Button>
          </>
        }
      >
        <div className="space-y-3 text-sm">
          <p>Se congelará una copia inmutable del informe con los datos actuales (RN-10).{a.estado === 'en_revision' && ' La auditoría quedará Cerrada.'}</p>
          {!(a.aprobaciones ?? []).some((x) => x.rol === 'auditor_lider') && <Alerta tipo="warn">Aún no hay aprobación del auditor líder.</Alerta>}
          <Field label="Comentario de la versión (opcional)">
            <Input value={comentario} onChange={(e) => setComentario(e.target.value)} placeholder="Ej.: incorpora verificación de eficacia" />
          </Field>
        </div>
      </Modal>
    </div>
  );
}
