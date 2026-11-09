// Escala de nivel de impacto del hallazgo (BAJA / MEDIA / ALTA) basada en criterios de las normas,
// para que no dependa solo de la interpretación del auditor.
//  · ISO 19011:2018 §6.4.8 — los hallazgos pueden graduarse según su importancia, considerando riesgos y contexto.
//  · ISO 45001 6.1.2 / 8.1.2 — peligros y riesgos para las personas.
//  · ISO 14001 6.1.2 — aspectos ambientales significativos.
//  · ISO 14001 / 45001 6.1.3 — requisitos legales (cumplimiento obligatorio).
//  · ISO 9001 8.7 / 9.1.2 — producto no conforme y satisfacción del cliente.
//  · 10.2 — la reincidencia indica que la acción correctiva anterior no fue eficaz.
import { normalizar } from '../lib/utils';
import type { Nivel, TipoHallazgo } from '../types';

export type Afecta = 'grave' | 'personas' | 'legal' | 'ambiente' | 'cliente' | 'documental';
export type Extension = 'aislado' | 'varios' | 'sistemico';

export interface Factores {
  afecta: Afecta[];
  extension: Extension | null;
  reincidente: boolean;
}

export const AFECTA: Record<Afecta, { label: string; peso: number; base: string; ayuda: string }> = {
  grave: { label: 'Riesgo grave o inminente', peso: 4, base: 'ISO 45001 8.1.2 / 8.2', ayuda: 'Podría causar lesión grave, incendio, electrocución, caída de altura o atrapamiento.' },
  personas: { label: 'Seguridad y salud de personas', peso: 3, base: 'ISO 45001 6.1.2', ayuda: 'Expone a trabajadores a un peligro (EPP, maniobras, orden, señalización).' },
  legal: { label: 'Requisito legal', peso: 3, base: 'ISO 14001 / 45001 6.1.3', ayuda: 'Incumple una ley, decreto o norma obligatoria (DS 594, Ley 16.744, SEC, SEREMI…).' },
  ambiente: { label: 'Medio ambiente', peso: 2, base: 'ISO 14001 6.1.2', ayuda: 'Derrames, residuos peligrosos, emisiones o manejo ambiental.' },
  cliente: { label: 'Cliente / producto', peso: 2, base: 'ISO 9001 8.7 / 9.1.2', ayuda: 'Afecta la calidad del equipo, la entrega o la satisfacción del cliente.' },
  documental: { label: 'Solo documentación / registro', peso: 0, base: 'ISO 9001 7.5', ayuda: 'Falta o está desactualizado un registro, sin efecto directo en producto, personas ni ambiente.' },
};

export const EXTENSION: Record<Extension, { label: string; peso: number; ayuda: string }> = {
  aislado: { label: 'Caso aislado', peso: 0, ayuda: 'Una sola vez / un solo registro.' },
  varios: { label: 'Se repite en varios casos', peso: 1, ayuda: 'Se observó en más de un registro, equipo o persona.' },
  sistemico: { label: 'Sistémico', peso: 2, ayuda: 'El requisito no está implementado o el proceso no existe.' },
};

export const CRITERIOS: Record<Nivel, string> = {
  ALTA: 'Riesgo para personas, incumplimiento legal repetido, impacto ambiental o al cliente extendido, requisito no implementado o reincidencia. Requiere acción inmediata.',
  MEDIA: 'Incumplimiento parcial del requisito, o que afecta a personas, ambiente, cliente o legal en un caso puntual. Acción dentro del plazo de seguimiento.',
  BAJA: 'Desviación puntual o documental, sin efecto en producto, personas ni ambiente; u oportunidad de mejora. Se corrige en el trabajo habitual.',
};

const SENALES: [Afecta | Extension | 'reincidente', string[]][] = [
  ['grave', ['caida de altura', 'altura', 'atrapamiento', 'electrocucion', 'electric', 'tablero', 'incendio', 'amago', 'explosion', 'cilindro', 'gas ', 'gases', 'izaje', 'carga suspendida', 'puente grua', 'grua', 'lesion grave', 'accidente grave', 'amputacion']],
  ['personas', ['epp', 'casco', 'guante', 'lente', 'zapato', 'arnes', 'trabajador', 'operario', 'personal expuesto', 'accidente', 'incidente', 'lesion', 'peligro', 'extintor', 'senaletica', 'senalizacion', 'orden y aseo', 'transito', 'pasillo', 'emergencia', 'evacuacion', 'hds', 'hoja de seguridad']],
  ['legal', ['ley ', 'decreto', 'ds 594', 'd s 594', '16 744', '16744', 'seremi', 'sec ', 'mutual', 'normativa legal', 'requisito legal', 'obligatori', 'fiscaliz', 'nch']],
  ['ambiente', ['residuo', 'respel', 'derrame', 'aceite', 'contamina', 'ambiental', 'emision', 'ruido', 'reciclaje', 'basura', 'quimico', 'sustancia']],
  ['cliente', ['cliente', 'reclamo', 'entrega', 'despacho', 'producto', 'equipo entregado', 'garantia', 'postventa', 'post venta', 'no conforme', 'rechazo', 'calidad del']],
  ['documental', ['registro', 'firma', 'formato', 'procedimiento desactualizado', 'actualizar', 'version', 'documento', 'archivo', 'carpeta']],
  ['sistemico', ['no existe', 'no cuenta con', 'no se ha implementado', 'no esta implementado', 'sin procedimiento', 'no se realiza', 'no se lleva', 'no hay registro', 'nunca', 'ningun', 'no se evidencia ningun']],
  ['varios', ['varios', 'varias', 'reiterad', 'en general', 'multiples', 'diversos', 'la mayoria', 'todos los', 'todas las', 'algunos', 'algunas']],
  ['aislado', ['un caso', 'un registro', 'puntual', 'una ocasion', 'aislado', 'un trabajador', 'un equipo']],
  ['reincidente', ['nuevamente', 'otra vez', 'reincid', 'se repite', 'ya fue levantad', 'auditoria anterior', 'ano anterior']],
];

/** Detecta factores en el texto del hallazgo (sugerencia; el auditor los ajusta). */
export function detectarFactores(texto: string, reincidenteAsistente = false): Factores {
  const n = ` ${normalizar(texto).replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ')} `;
  const hay = (k: string) => SENALES.find(([c]) => c === k)![1].some((s) => n.includes(` ${s}`));
  const afecta = (['grave', 'personas', 'legal', 'ambiente', 'cliente', 'documental'] as Afecta[]).filter((a) => hay(a));
  // "Solo documental" deja de aplicar si hay efectos reales
  const reales = afecta.filter((a) => a !== 'documental');
  const extension: Extension | null = hay('sistemico') ? 'sistemico' : hay('varios') ? 'varios' : hay('aislado') ? 'aislado' : null;
  return { afecta: reales.length ? reales : afecta, extension, reincidente: reincidenteAsistente || hay('reincidente') };
}

/** Calcula el nivel y los fundamentos. */
export function calcularNivel(f: Factores, tipo: TipoHallazgo): { nivel: Nivel; puntaje: number; motivos: string[] } {
  const motivos: string[] = [];
  const sev = f.afecta.length ? Math.max(...f.afecta.map((a) => AFECTA[a].peso)) : 1;
  const principal = f.afecta.slice().sort((a, b) => AFECTA[b].peso - AFECTA[a].peso)[0];
  if (principal) motivos.push(`${AFECTA[principal].label} (${AFECTA[principal].base}): +${AFECTA[principal].peso}`);
  else motivos.push('Afecta al cumplimiento del requisito, sin efectos adicionales identificados: +1');
  const ext = f.extension ? EXTENSION[f.extension].peso : 1;
  motivos.push(f.extension ? `${EXTENSION[f.extension].label}: +${ext}` : 'Extensión no indicada (se asume más de un caso): +1');
  let p = sev + ext;
  if (f.reincidente) { p += 1; motivos.push('Reincidencia — la acción anterior no fue eficaz (10.2): +1'); }
  if (tipo === 'OM') { p -= 1; motivos.push('Oportunidad de mejora (no hay incumplimiento): −1'); }
  const nivel: Nivel = p >= 4 ? 'ALTA' : p >= 2 ? 'MEDIA' : 'BAJA';
  return { nivel, puntaje: p, motivos };
}
