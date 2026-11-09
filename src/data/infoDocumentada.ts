// Ayuda memoria: qué cláusulas exigen MANTENER (documento vigente) o CONSERVAR (registro/evidencia) información documentada.
// Base: lista de FMA contrastada con ISO 9001:2015 (apartado 4.4.2, 5.2.2, 6.2.1, 7.1.5, 7.2, 8.x, 9.x, 10.2). Se resume, no se transcribe.
import type { Norma } from '../types';

export type ModoInfo = 'mantener' | 'conservar';

export interface InfoDocumentada {
  clave: string;
  modo: ModoInfo;
  /** Qué documento o registro pedirle al área. */
  revisar: string;
  /** Solo para estas normas (por defecto todas). */
  normas?: Norma[];
  /** Observación cuando se difiere de la lista inicial de FMA. */
  nota?: string;
}

export const MODO_TXT: Record<ModoInfo, { titulo: string; idea: string }> = {
  mantener: { titulo: 'Mantener', idea: 'Documento vivo: debe existir, estar vigente, aprobado y disponible en el área.' },
  conservar: { titulo: 'Conservar', idea: 'Registro o evidencia: debe quedar guardado como prueba de que la actividad se hizo.' },
};

export const INFO_DOCUMENTADA: InfoDocumentada[] = [
  { clave: '4.4', modo: 'mantener', revisar: 'Procedimientos, instrucciones y mapa de procesos del área: vigentes, aprobados y accesibles donde se trabaja (y registros que muestren que los procesos se ejecutan según lo planificado).' },
  { clave: '5.2', modo: 'mantener', revisar: 'Política vigente, disponible en el área (visible o accesible) y que el personal la conozca.' },
  { clave: '6.1', modo: 'mantener', revisar: 'Matriz de riesgos y oportunidades del área (y matriz de aspectos ambientales / IPER y requisitos legales, según la norma), actualizada ante cambios.' },
  { clave: '6.2', modo: 'mantener', revisar: 'Objetivos del área, indicadores, metas, responsables, plazos y plan para lograrlos, con seguimiento al día.' },
  { clave: '6.3', modo: 'mantener', revisar: 'Evaluación del cambio antes de implementarlo (qué cambia, riesgos, responsables) y su aprobación.', normas: ['ISO 14001', 'ISO 9001'] },
  { clave: '7.1', modo: 'mantener', revisar: 'Documentos que definen los recursos del área: infraestructura, ambiente de trabajo, plan de mantención de equipos vigente.' },
  { clave: '7.1.5', modo: 'conservar', normas: ['ISO 9001'], revisar: 'Certificados y registros de calibración/verificación de los equipos de medición, con trazabilidad a patrón; evidencia de que los recursos de seguimiento y medición son idóneos.', nota: 'En la ISO 9001 (7.1.5.1 y 7.1.5.2) se pide conservar; estaba en la lista como mantener.' },
  { clave: '7.2', modo: 'conservar', revisar: 'Evidencia de competencia: perfiles de cargo, registros de capacitación, evaluaciones de eficacia, certificados y experiencia del personal del área.', nota: 'La norma pide conservar evidencia de competencia (7.2 d); estaba en la lista como mantener.' },
  { clave: '8.1', modo: 'mantener', revisar: 'Procedimientos y criterios operacionales del área vigentes; planificación y control de las actividades (y registros de que se aplicaron cuando corresponda).' },
  { clave: '8.2.3', modo: 'conservar', normas: ['ISO 9001'], revisar: 'Registros de la revisión de requisitos de productos y servicios (cotizaciones, órdenes, cambios aprobados con el cliente).' },
  { clave: '8.3', modo: 'conservar', normas: ['ISO 9001'], revisar: 'Diseño y desarrollo: entradas, salidas, revisiones, verificaciones, validaciones y cambios documentados (planos, memorias, actas).' },
  { clave: '8.4', modo: 'conservar', normas: ['ISO 9001'], revisar: 'Evaluación y reevaluación de proveedores externos y acciones derivadas.' },
  { clave: '8.5.2', modo: 'conservar', normas: ['ISO 9001'], revisar: 'Identificación y trazabilidad de las salidas (lotes, números de serie, rutas, registros de producción).' },
  { clave: '8.5.3', modo: 'conservar', normas: ['ISO 9001'], revisar: 'Registro de lo ocurrido con bienes del cliente o proveedor externo dañados, perdidos o inadecuados.' },
  { clave: '8.6', modo: 'conservar', normas: ['ISO 9001'], revisar: 'Registros de liberación de productos y servicios: inspección final, quién autorizó y trazabilidad a la persona.' },
  { clave: '8.7', modo: 'conservar', normas: ['ISO 9001'], revisar: 'Registro de salidas no conformes: descripción, acciones tomadas, concesiones y quién decidió.' },
  { clave: '9.1', modo: 'conservar', revisar: 'Registros de seguimiento y medición: indicadores, resultados, análisis y evidencia de la evaluación del desempeño y de la eficacia.' },
  { clave: '9.2', modo: 'conservar', revisar: 'Programa de auditoría, informes de auditorías anteriores y evidencia de las acciones tomadas sin demora.' },
  { clave: '9.3', modo: 'conservar', revisar: 'Actas de la revisión por la dirección y evidencia de sus decisiones (mejoras, cambios, recursos).' },
  { clave: '10.2', modo: 'conservar', revisar: 'Registro de la no conformidad, causa raíz, acciones correctivas tomadas y su eficacia; verificar que el registro esté completo y cerrado.' },
];

const norm = (c: string) => c.trim();

/** Busca la ayuda memoria que corresponde a una cláusula (coincidencia exacta, hija o madre; gana la más específica). */
export function ayudaMemoria(norma: Norma, clausula: string): InfoDocumentada | null {
  const c = norm(clausula);
  let mejor: { it: InfoDocumentada; peso: number } | null = null;
  for (const it of INFO_DOCUMENTADA) {
    if (it.normas && !it.normas.includes(norma)) continue;
    let peso = 0;
    if (it.clave === c) peso = 1000;
    else if (c.startsWith(it.clave + '.')) peso = 500 + it.clave.length; // cláusula hija (6.1.2 → 6.1)
    else if (it.clave.startsWith(c + '.')) peso = 100 - it.clave.length; // cláusula madre (9.3 → 9.3.3 ya cubierta arriba)
    if (peso && (!mejor || peso > mejor.peso)) mejor = { it, peso };
  }
  return mejor?.it ?? null;
}
