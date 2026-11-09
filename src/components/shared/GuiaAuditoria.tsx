import { useMemo, useState } from 'react';
import { BookOpenCheck, CircleAlert, CircleCheck } from 'lucide-react';
import { resumenPlan, vincularPlan } from '../../domain/plan';
import { useData } from '../../context/DataContext';
import { cn } from '../../lib/utils';
import type { Auditoria, Evidencia, Hallazgo } from '../../types';

/**
 * Guía del auditor basada en ISO 19011:2018 (directrices para auditar sistemas de gestión).
 * Redactada con palabras propias y ordenada según las etapas de la hoja de auditoría.
 */
type Fase = 'preparar' | 'apertura' | 'evidencia' | 'hallazgos' | 'cierre';

const FASES: { id: Fase; titulo: string; ref: string }[] = [
  { id: 'preparar', titulo: 'Preparar', ref: '§4 · §6.2–6.3' },
  { id: 'apertura', titulo: 'Reunión de apertura', ref: '§6.4.3' },
  { id: 'evidencia', titulo: 'Recopilar evidencia', ref: '§6.4.7 · A.6 · A.17' },
  { id: 'hallazgos', titulo: 'Hallazgos', ref: '§6.4.8 · A.18' },
  { id: 'cierre', titulo: 'Cierre e informe', ref: '§6.4.9–6.5' },
];

const CONTENIDO: Record<Exclude<Fase, 'cierre'>, { intro: string; items: string[] }> = {
  preparar: {
    intro: 'Una buena auditoría se decide antes de entrar al área.',
    items: [
      'Independencia: no audites tu propia área ni una función en la que tengas interés; si no se puede evitar, deja constancia y refuerza la objetividad.',
      'Enfoque en riesgo: parte por lo más importante para el área (NC anteriores, temas recurrentes, procesos críticos) y revisa los puntos que quedaron sin evaluar la vez anterior.',
      'Revisa antes la información documentada del área (procedimientos, matrices, registros) para llegar con preguntas concretas.',
      'Confirma con el auditado fecha, hora, quiénes participan y si hay restricciones (acceso, seguridad, confidencialidad).',
      'Reparte las tareas dentro del equipo: quién ve qué punto del plan y quién toma notas.',
    ],
  },
  apertura: {
    intro: 'Es breve, pero ordena la auditoría y baja la tensión.',
    items: [
      'Presenta al equipo, el objetivo, el alcance y los criterios (normas) que se auditarán.',
      'Explica cómo se trabajará: entrevistas, observación en terreno y revisión de registros.',
      'Aclara que se trabaja por muestreo: lo que se vea no es necesariamente representativo de todo el proceso.',
      'Acuerda el canal de comunicación durante la auditoría y cuándo será la reunión de cierre.',
      'Confirma confidencialidad de la información y pide un guía o contacto del área.',
    ],
  },
  evidencia: {
    intro: 'Solo es evidencia lo que se puede verificar.',
    items: [
      'Tres fuentes: entrevistas, observación y revisión de documentos/registros. Idealmente cruza al menos dos para un mismo hallazgo.',
      'Muestrea con criterio: elige casos distintos (turnos, productos, fechas) y anota cuántos revisaste; el tamaño de muestra respalda tu hallazgo.',
      'En entrevistas: habla con quien hace la tarea, en su lugar de trabajo, parte pidiéndole que describa su trabajo, usa preguntas abiertas y resume lo que entendiste para confirmarlo.',
      'Si la información no se puede verificar, úsala con cautela: evalúa qué tan confiable es antes de apoyar un hallazgo en ella.',
      'Registra la evidencia en el momento (foto, número de registro, nombre del documento) y adjúntala al hallazgo.',
    ],
  },
  hallazgos: {
    intro: 'Un hallazgo sólido compara evidencia con un criterio.',
    items: [
      'Estructura: criterio (cláusula o procedimiento) + evidencia objetiva + declaración de la conformidad o no conformidad.',
      'Registra también conformidades y buenas prácticas con su evidencia, no solo lo que falla; las oportunidades de mejora van como OM y no son obligatorias.',
      'Gradúa la no conformidad según el contexto y el riesgo del área (escala de impacto de esta app) y revisa si es un caso aislado o sistémico.',
      'Si un hecho incumple varias normas (9001, 14001, 45001), puedes registrar un solo hallazgo con varias cláusulas o uno por criterio; de acuerdo con el auditado, sé consistente.',
      'Revisa el hallazgo con el auditado para confirmar que la evidencia es exacta y que se entendió. Si hay desacuerdo que no se resuelve, déjalo anotado.',
      'Entre los auditores, reúnanse durante la jornada para revisar y alinear los hallazgos.',
    ],
  },
};

export function GuiaAuditoria({ auditoria: a, hallazgos, evidencias }: { auditoria: Auditoria; hallazgos: Hallazgo[]; evidencias: Evidencia[] }) {
  const { mapa } = useData();
  const [fase, setFase] = useState<Fase>('preparar');
  const [abierto, setAbierto] = useState(false);

  const chequeo = useMemo(() => {
    const vivos = hallazgos.filter((h) => !h.anulado);
    const sinEvidencia = vivos.filter((h) => !evidencias.some((e) => e.hallazgoId === h.id));
    const plan = a.plan ?? [];
    const r = plan.length ? resumenPlan(plan, vincularPlan(plan, vivos, mapa.requisitos)) : null;
    return [
      { ok: !!a.objetivos?.trim(), txt: 'Objetivos de la auditoría', det: 'a' },
      { ok: !!a.alcance?.trim() && !!a.sucursalId, txt: 'Alcance y funciones o procesos auditados', det: 'b' },
      { ok: !!a.auditorLiderId && !!a.auditadosTexto?.trim(), txt: 'Equipo auditor y participantes del auditado', det: 'd' },
      { ok: !!(a.fechaRealizacion ?? a.fechaPlanificada), txt: 'Fecha y lugar de la auditoría', det: 'e' },
      { ok: a.normas.length > 0, txt: 'Criterios de auditoría (normas)', det: 'f' },
      { ok: vivos.length === 0 || sinEvidencia.length === 0, txt: vivos.length ? (sinEvidencia.length ? `Hallazgos con evidencia (${sinEvidencia.length} sin fotos o respaldo)` : 'Hallazgos con su evidencia adjunta') : 'Hallazgos (sin hallazgos registrados)', det: 'g' },
      { ok: !!a.notas?.trim(), txt: 'Conclusiones o notas del auditor en el informe', det: 'h' },
      { ok: !!r && r.pendiente === 0, txt: r ? `Grado en que se cumplió el plan (${r.revisados}/${r.total} puntos revisados)` : 'Plan de auditoría (aún sin plan cargado)', det: 'i' },
    ];
  }, [a, hallazgos, evidencias, mapa.requisitos]);
  const faltan = chequeo.filter((c) => !c.ok).length;

  return (
    <section className="rounded-xl border border-zinc-200 bg-surface">
      <button type="button" onClick={() => setAbierto(!abierto)} aria-expanded={abierto} className="flex w-full items-center gap-2 px-4 py-3 text-left">
        <BookOpenCheck className="h-4 w-4 text-brand" />
        <span className="text-sm font-semibold text-zinc-800">Guía del auditor · ISO 19011:2018</span>
        {faltan > 0 && a.estado !== 'cerrada' && <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10.5px] font-bold text-amber-900">{faltan} por completar para el informe</span>}
        <span className="ml-auto text-xs text-zinc-500">{abierto ? 'ocultar' : 'ver'}</span>
      </button>
      {abierto && (
        <div className="border-t border-zinc-100 px-4 pb-4 pt-3">
          <div className="mb-3 flex flex-wrap gap-1.5" role="tablist">
            {FASES.map((f) => (
              <button key={f.id} type="button" role="tab" aria-selected={fase === f.id} onClick={() => setFase(f.id)} className={cn('rounded-full border px-3 py-1 text-xs font-semibold transition', fase === f.id ? 'border-panel bg-panel text-white' : 'border-zinc-300 text-zinc-700 hover:border-zinc-500')}>
                {f.titulo}
              </button>
            ))}
          </div>
          <p className="mb-2 text-[11px] text-zinc-500">Referencia: ISO 19011:2018 {FASES.find((f) => f.id === fase)!.ref}</p>
          {fase !== 'cierre' ? (
            <>
              <p className="mb-2 text-sm font-medium text-zinc-800">{CONTENIDO[fase].intro}</p>
              <ul className="list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-zinc-700">
                {CONTENIDO[fase].items.map((t) => <li key={t}>{t}</li>)}
              </ul>
            </>
          ) : (
            <>
              <p className="mb-2 text-sm font-medium text-zinc-800">Antes de la reunión de cierre, el equipo acuerda las conclusiones; el informe debe quedar completo, claro y exacto.</p>
              <ul className="space-y-1 text-[13px]">
                {chequeo.map((c) => (
                  <li key={c.det} className={cn('flex items-start gap-2', c.ok ? 'text-zinc-700' : 'font-semibold text-amber-800')}>
                    {c.ok ? <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />}
                    {c.txt}
                  </li>
                ))}
              </ul>
              <ul className="mt-3 list-disc space-y-1.5 pl-5 text-[13px] leading-relaxed text-zinc-700">
                <li>Las conclusiones deben decir el grado de conformidad con los criterios, si el sistema se implementa y mantiene de forma eficaz, y si hay hallazgos similares en otras áreas (tendencia).</li>
                <li>En la reunión de cierre preside el auditor líder, con la jefatura del área: presenta hallazgos y conclusiones, recuerda que la evidencia es una muestra, acuerda plazos para el plan de acción y explica el seguimiento posterior.</li>
                <li>Si hay opiniones distintas entre el equipo y el auditado que no se resolvieron, regístralas en las notas del informe. Las recomendaciones de mejora no son obligatorias.</li>
                <li>Entrega el informe en el plazo acordado, fechado y revisado, y cuida la confidencialidad al distribuirlo.</li>
              </ul>
            </>
          )}
        </div>
      )}
    </section>
  );
}
