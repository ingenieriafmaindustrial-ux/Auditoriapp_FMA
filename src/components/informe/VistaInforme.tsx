import type { ReactNode } from 'react';
import { NORMA_VERSION } from '../../lib/constants';
import { fmtFecha, fmtFechaHora } from '../../lib/dates';
import type { InformeSnapshot, RevisionDoc } from '../../types';

export const ETIQUETA_REVISION: Record<RevisionDoc['tipo'], string> = {
  envio: 'Enviada a revisión',
  observacion: 'Devuelta con observaciones',
  aprobacion: 'Aprobada',
  emision: 'Aprobada y emitida',
  reapertura: 'Reabierta',
};

function Seccion({ titulo, children }: { titulo: string; children: ReactNode }) {
  return (
    <section className="mt-6">
      <h3 className="mb-2 border-b-2 border-panel pb-1 text-sm font-bold tracking-wide">{titulo}</h3>
      {children}
    </section>
  );
}

/** Vista del informe con la estructura de la plantilla v11/2026. */
export function VistaInforme({ s }: { s: InformeSnapshot }) {
  const est: Record<string, string> = { no_tratada: 'No tratada', en_seguimiento: 'En seguimiento', tratada: 'Tratada' };
  return (
    <div className="mx-auto max-w-4xl rounded-lg border border-zinc-300 bg-surface p-4 text-sm sm:p-8">
      <div className="grid grid-cols-[64px_1fr_auto] items-center gap-3 border border-zinc-400 p-2">
        <img src="/logo-fma.png" alt="FMA" className="h-14 w-14" />
        <p className="text-center font-bold">INFORME DE AUDITORÍA INTERNA</p>
        <p className="text-right text-xs">Versión 11/2026<br /><span className="text-zinc-500">Informe</span></p>
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
                  <td>{h.verificacionResultado ? <><b>{h.verificacionResultado === 'eficaz' ? 'EFICAZ' : 'NO EFICAZ'}</b> · <span className="whitespace-pre-line">{h.verificacionAnalisis}</span></> : <i className="text-zinc-500">Eficacia por verificar · {est[h.estado]}</i>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Seccion>

      <Seccion titulo="EVIDENCIA FOTOGRÁFICA">
        <p className="text-zinc-600">{s.evidencias.length} fotografía(s) — se insertan en el Word exportado.</p>
      </Seccion>

      <Seccion titulo="CONTROL DE REVISIONES">
        {(s.revisiones ?? []).length === 0 ? (
          <p className="text-zinc-500">Sin revisiones registradas.</p>
        ) : (
          <div className="table-wrap rounded-none">
            <table className="tabla">
              <thead><tr><th>N°</th><th>Fecha</th><th>Revisión</th><th>Responsable</th><th>Comentario</th></tr></thead>
              <tbody>
                {s.revisiones.map((r, i) => (
                  <tr key={r.id}>
                    <td>{i + 1}</td>
                    <td className="whitespace-nowrap">{fmtFechaHora(r.fecha)}</td>
                    <td className="whitespace-nowrap">{ETIQUETA_REVISION[r.tipo]}{r.version ? ` v${r.version}` : ''}</td>
                    <td>{r.usuarioNombre}</td>
                    <td className="whitespace-pre-line">{r.comentario || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
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

