// Planes de auditoría FMA 2026: puntos TEXTUALES de los documentos de la carpeta "Planes de auditoria" (mismo orden).
// Generado desde los .docx; solo se agregan cláusulas ISO sugeridas (editables) para el match con los hallazgos.
// Los códigos sueltos (PGI / ISGI) quedan sin cláusula: se relacionan por la referencia citada en el hallazgo.
import type { GrupoPlan, PuntoPlan } from '../types';

type Def = { titulo: string; grupo: GrupoPlan; requisitos: string[]; referencia: string | null };

export const PLANES_SEED: Record<string, Def[]> = {
  "adquisiciones": [
    {
      "titulo": "Políticas del SGI",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.2",
        "ISO 14001|5.2",
        "ISO 45001|5.2"
      ],
      "referencia": null
    },
    {
      "titulo": "PGI-06",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.4.1",
        "ISO 9001|8.4.2",
        "ISO 9001|8.4.3"
      ],
      "referencia": "PGI-06"
    },
    {
      "titulo": "Proceso de evaluación de proveedores",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.4.1",
        "ISO 45001|8.1.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Aspectos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Peligros, riesgos y situaciones de emergencia",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2",
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Objetivos y metas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|6.2",
        "ISO 14001|6.2.1",
        "ISO 45001|6.2.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Registros",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|7.5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Fichas de proceso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Flujograma",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de liderazgo y compromiso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.1",
        "ISO 45001|5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Roles y responsabilidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.3",
        "ISO 14001|5.3",
        "ISO 45001|5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Comunicación con partes interesadas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|7.4",
        "ISO 14001|7.4",
        "ISO 45001|7.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ],
  "bodega": [
    {
      "titulo": "Política de SGI",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.2",
        "ISO 14001|5.2",
        "ISO 45001|5.2"
      ],
      "referencia": null
    },
    {
      "titulo": "PGI-14",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.5.4"
      ],
      "referencia": "PGI-14"
    },
    {
      "titulo": "Procedimiento de almacenamiento de materiales PGI 29",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.5.4"
      ],
      "referencia": "PGI-29"
    },
    {
      "titulo": "Peligros y riesgos asociados",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Aspectos e impactos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Registros EPP y Hojas de Seguridad (HDS)",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.1.2",
        "ISO 45001|6.1.3"
      ],
      "referencia": null
    },
    {
      "titulo": "ISGI 07 Cilindros gases",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.1.2"
      ],
      "referencia": "ISGI-07"
    },
    {
      "titulo": "Fichas de proceso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Plan de emergencias",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ],
  "control de calidad": [
    {
      "titulo": "Políticas del SGI",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.2",
        "ISO 14001|5.2",
        "ISO 45001|5.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Aspectos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Peligros, riesgos y situaciones de emergencia",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2",
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Procedimiento PGI 21,15",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.6",
        "ISO 9001|7.1.5"
      ],
      "referencia": "PGI-21, PGI-15"
    },
    {
      "titulo": "ISGI-13",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.1.2"
      ],
      "referencia": "ISGI-13"
    },
    {
      "titulo": "Registros",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|7.5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Salidas No Conforme",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.7"
      ],
      "referencia": null
    },
    {
      "titulo": "Control de producción",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Liberación de los productos",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.6"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de liderazgo y compromiso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.1",
        "ISO 45001|5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Roles y responsabilidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.3",
        "ISO 14001|5.3",
        "ISO 45001|5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Comunicación con partes interesadas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|7.4",
        "ISO 14001|7.4",
        "ISO 45001|7.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ],
  "diseno": [
    {
      "titulo": "Políticas del SGI",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.2",
        "ISO 14001|5.2",
        "ISO 45001|5.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Aspectos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Peligros, riesgos y situaciones de emergencia",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2",
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Procedimiento PGI 08-21",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.3.4",
        "ISO 9001|8.3.5",
        "ISO 9001|8.6"
      ],
      "referencia": "PGI-08, PGI-21"
    },
    {
      "titulo": "Registros",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|7.5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Salidas No Conforme",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.7"
      ],
      "referencia": null
    },
    {
      "titulo": "Fichas de proceso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de liderazgo y compromiso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.1",
        "ISO 45001|5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Roles y responsabilidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.3",
        "ISO 14001|5.3",
        "ISO 45001|5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Comunicación con partes interesadas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|7.4",
        "ISO 14001|7.4",
        "ISO 45001|7.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ],
  "post venta": [
    {
      "titulo": "PGI-09",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.5.1"
      ],
      "referencia": "PGI-09"
    },
    {
      "titulo": "HCR",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2",
        "ISO 45001|8.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Registros de trabajo en terreno",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|7.5.3",
        "ISO 9001|8.5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Aspectos e impactos",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Peligros y Riesgos",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Plan de emergencias",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Planificación de trabajo en terreno",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Análisis de contexto",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.1",
        "ISO 9001|4.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Fichas de proceso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Validación de los procesos de entrega de los servicios o equipos",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.5.1",
        "ISO 9001|8.6"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ],
  "prevencion": [
    {
      "titulo": "Política de gestión",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.2",
        "ISO 14001|5.2",
        "ISO 45001|5.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Objetivos y metas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|6.2",
        "ISO 14001|6.2.1",
        "ISO 45001|6.2.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de peligros y riesgos",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de aspectos e impactos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Cumplimiento legal",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.3",
        "ISO 14001|9.1.2",
        "ISO 45001|6.1.3",
        "ISO 45001|9.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Comité Paritario",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|5.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Informes de simulacros",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Planes de emergencia",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Planos de evacuación y extintores",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Programa de extintores",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Accidentes e incidentes",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Tratamientos de residuos",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|8.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Disposición y retiro de residuos peligrosos",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|8.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Disposición final de residuos",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|8.1"
      ],
      "referencia": null
    },
    {
      "titulo": "PGI 18",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-18"
    },
    {
      "titulo": "PGI 19",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-19"
    },
    {
      "titulo": "PGI 20",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-20"
    },
    {
      "titulo": "PGI 23",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-23"
    },
    {
      "titulo": "PGI 26",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-26"
    },
    {
      "titulo": "PGI 32",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-32"
    },
    {
      "titulo": "ISGI – 04",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "ISGI-04"
    },
    {
      "titulo": "ISGI-13",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.1.2"
      ],
      "referencia": "ISGI-13"
    },
    {
      "titulo": "Identificación y evaluación de aspectos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Programa para la preparación de la emergencia",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de liderazgo y compromiso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.1",
        "ISO 45001|5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Roles y responsabilidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.3",
        "ISO 14001|5.3",
        "ISO 45001|5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Comunicación con partes interesadas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|7.4",
        "ISO 14001|7.4",
        "ISO 45001|7.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ],
  "produccion": [
    {
      "titulo": "Políticas del SGI",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.2",
        "ISO 14001|5.2",
        "ISO 45001|5.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Procedimientos e instructivos aplicables",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|7.5.3",
        "ISO 9001|8.5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "PGI 08",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-08"
    },
    {
      "titulo": "PGI 11",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-11"
    },
    {
      "titulo": "PGI 23",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-23"
    },
    {
      "titulo": "PGI 29",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-29"
    },
    {
      "titulo": "ISGI-13",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|8.1.2"
      ],
      "referencia": "ISGI-13"
    },
    {
      "titulo": "Objetivos y metas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|6.2",
        "ISO 14001|6.2.1",
        "ISO 45001|6.2.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Registros Inspecciones (herramientas, observaciones de conducta, charlas)",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|9.1.1",
        "ISO 45001|7.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Aspectos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Peligros y riesgos y situación de emergencia",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2",
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Análisis de contexto",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.1",
        "ISO 9001|4.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Fichas de proceso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Acciones para abordar los Riesgos y oportunidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|6.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de liderazgo y compromiso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.1",
        "ISO 45001|5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Roles y responsabilidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.3",
        "ISO 14001|5.3",
        "ISO 45001|5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Comunicación con partes interesadas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|7.4",
        "ISO 14001|7.4",
        "ISO 45001|7.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ],
  "recursos humanos": [
    {
      "titulo": "Políticas del SGI",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.2",
        "ISO 14001|5.2",
        "ISO 45001|5.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Aspectos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Peligros, riesgos y situaciones de emergencia",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2",
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Procedimiento PGI 12",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-12"
    },
    {
      "titulo": "Registros",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|7.5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Salidas No Conforme",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.7"
      ],
      "referencia": null
    },
    {
      "titulo": "Fichas de proceso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Flujograma",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de liderazgo y compromiso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.1",
        "ISO 45001|5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Roles y responsabilidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.3",
        "ISO 14001|5.3",
        "ISO 45001|5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Comunicación con partes interesadas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|7.4",
        "ISO 14001|7.4",
        "ISO 45001|7.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz legal",
      "grupo": "sistema",
      "requisitos": [
        "ISO 14001|6.1.3",
        "ISO 45001|6.1.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Reglamento interno",
      "grupo": "sistema",
      "requisitos": [
        "ISO 45001|6.1.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ],
  "ventas": [
    {
      "titulo": "Política del SGI",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.2",
        "ISO 14001|5.2",
        "ISO 45001|5.2"
      ],
      "referencia": null
    },
    {
      "titulo": "PGI 05, 07",
      "grupo": "operacion",
      "requisitos": [],
      "referencia": "PGI-05, PGI-07"
    },
    {
      "titulo": "Identificación del requerimiento del cliente",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.2.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Reclamos y evaluación de satisfacción del cliente",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.2.1",
        "ISO 9001|9.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Preparación y seguimiento de propuesta comercial",
      "grupo": "operacion",
      "requisitos": [
        "ISO 9001|8.2.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Objetivos y metas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|6.2",
        "ISO 14001|6.2.1",
        "ISO 45001|6.2.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Aspectos ambientales",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 14001|6.1.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Peligros y riesgos y situación de emergencia",
      "grupo": "sst_ambiente",
      "requisitos": [
        "ISO 45001|6.1.2",
        "ISO 45001|8.2",
        "ISO 14001|8.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Análisis de contexto",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.1",
        "ISO 9001|4.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Fichas de proceso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|4.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Acciones para abordar los Riesgos y oportunidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|6.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de no conformidades generadas",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.2",
        "ISO 14001|10.2",
        "ISO 45001|10.2"
      ],
      "referencia": null
    },
    {
      "titulo": "Seguimiento de oportunidades de mejora",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|10.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Matriz de liderazgo y compromiso",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.1",
        "ISO 45001|5.1"
      ],
      "referencia": null
    },
    {
      "titulo": "Roles y responsabilidades",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|5.3",
        "ISO 14001|5.3",
        "ISO 45001|5.3"
      ],
      "referencia": null
    },
    {
      "titulo": "Comunicación con partes interesadas",
      "grupo": "sistema",
      "requisitos": [
        "ISO 9001|7.4",
        "ISO 14001|7.4",
        "ISO 45001|7.4"
      ],
      "referencia": null
    },
    {
      "titulo": "Reuniones de revisión interna",
      "grupo": "seguimiento",
      "requisitos": [
        "ISO 9001|9.1.3"
      ],
      "referencia": null
    }
  ]
};

const norm = (s: string) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z ]+/g, ' ').replace(/\s+/g, ' ').trim();

/** Clave de plan FMA para un nombre de área o de proceso ("Prev. de riesgos y MA", "POST - VENTAS"…). */
export function claveAreaPlan(nombre: string): string | null {
  const n = norm(nombre);
  return n.includes('adquis') || n.includes('abastec') ? 'adquisiciones'
    : n.includes('bodega') ? 'bodega'
    : n.includes('calidad') ? 'control de calidad'
    : n.includes('diseno') || n.includes('plano') ? 'diseno'
    : n.includes('post') || n.includes('posventa') ? 'post venta'
    : n.includes('prevenc') || n.includes('riesgo') || n.includes('ambiente') ? 'prevencion'
    : n.includes('produc') ? 'produccion'
    : n.includes('recursos humanos') || n.includes('rrhh') || n.includes('personas') ? 'recursos humanos'
    : n.includes('venta') ? 'ventas'
    : null;
}

/** Busca el plan FMA que corresponde a un nombre de área. */
export function planSeedParaArea(nombreArea: string): PuntoPlan[] | null {
  const clave = claveAreaPlan(nombreArea);
  if (!clave) return null;
  return PLANES_SEED[clave].map((p, i) => ({ ...p, id: `p${String(i + 1).padStart(2, '0')}`, requisitos: [...new Set(p.requisitos)] }));
}

const normPunto = (s: string) =>
  s.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\d+/g, (d) => ` ${Number(d)} `).replace(/[^a-z0-9]+/g, ' ').trim();
const CONOCIDOS = new Map(Object.values(PLANES_SEED).flat().map((p) => [normPunto(p.titulo), p]));

/** Referencias PGI / ISGI citadas en el texto del punto ("Procedimiento PGI 21,15" → "PGI-21, PGI-15"). */
export function referenciasDePunto(t: string): string | null {
  const out: string[] = [];
  for (const m of t.matchAll(/\b(PGI|ISGI)\s*[-–]?\s*(\d{1,2}(?:\s*[,-]\s*\d{1,2})*)/gi))
    m[2].split(/\s*[,-]\s*/).forEach((n) => out.push(`${m[1].toUpperCase()}-${n.padStart(2, '0')}`));
  return out.length ? [...new Set(out)].join(', ') : null;
}

/**
 * Convierte los textos de un plan (importado de Word o pegado) en puntos.
 * Mantiene el texto y el orden; si el punto ya es conocido en los planes FMA, sugiere sus cláusulas.
 */
export function puntosPlanDesdeTextos(textos: string[], prefijo = 'p'): PuntoPlan[] {
  return textos.map((titulo, i) => {
    const k = CONOCIDOS.get(normPunto(titulo));
    return {
      id: `${prefijo}${String(i + 1).padStart(2, '0')}`,
      titulo,
      grupo: k?.grupo ?? 'operacion',
      requisitos: k ? [...new Set(k.requisitos)] : [],
      referencia: referenciasDePunto(titulo),
    };
  });
}
