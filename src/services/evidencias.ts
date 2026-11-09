import imageCompression from 'browser-image-compression';
import { deleteDoc, doc, getDoc, updateDoc, writeBatch, collection } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import { COL, registrarBitacora } from './base';
import type { Evidencia, Usuario } from '../types';

/**
 * Almacenamiento de evidencias (decisión P4 = Opción B: Firestore, sin Cloud Storage).
 * Toda la app usa esta interfaz; migrar a Storage = reemplazar solo este archivo.
 */
export interface EvidenceStore {
  subir(u: Usuario, file: File, meta: EvidenciaMeta): Promise<{ id: string; bytes: number; original: number }>;
  obtenerImagen(id: string): Promise<string | null>;
  actualizarDescripcion(id: string, descripcion: string): Promise<void>;
  eliminar(u: Usuario, ev: Evidencia): Promise<void>;
}

export interface EvidenciaMeta {
  auditoriaId: string;
  participantes: string[];
  hallazgoId: string | null;
  checklistItemId: string | null;
  descripcion: string;
}

const MAX_BYTES_DATAURL = 900_000;

function leerDataURL(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

function dimensiones(dataUrl: string): Promise<{ ancho: number; alto: number }> {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => resolve({ ancho: img.naturalWidth, alto: img.naturalHeight });
    img.onerror = () => resolve({ ancho: 0, alto: 0 });
    img.src = dataUrl;
  });
}

/**
 * RN-13: compresión máxima en el dispositivo antes de guardar.
 * Objetivo ~70 KB por foto (1200 px, JPEG): mínimo peso conservando legible un documento fotografiado.
 * Si no alcanza, reintenta más chico. La compresión por canvas elimina además los metadatos EXIF (GPS, equipo).
 * JPEG (y no WebP) porque el informe Word solo acepta JPG/PNG.
 */
const PASOS_COMPRESION = [
  { maxWidthOrHeight: 1200, maxSizeMB: 0.07, initialQuality: 0.62 },
  { maxWidthOrHeight: 1024, maxSizeMB: 0.055, initialQuality: 0.56 },
  { maxWidthOrHeight: 800, maxSizeMB: 0.045, initialQuality: 0.5 },
];

async function comprimir(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Solo se admiten imágenes como evidencia.');
  let full: File | null = null;
  let datos = '';
  for (const paso of PASOS_COMPRESION) {
    full = await imageCompression(file, { ...paso, fileType: 'image/jpeg', useWebWorker: true });
    datos = await leerDataURL(full);
    if (full.size <= paso.maxSizeMB * 1024 * 1024 * 1.15) break;
  }
  if (!full || datos.length > MAX_BYTES_DATAURL) throw new Error('La imagen es demasiado grande incluso comprimida.');
  const mini = await imageCompression(file, { maxWidthOrHeight: 200, maxSizeMB: 0.01, fileType: 'image/jpeg', initialQuality: 0.5, useWebWorker: true });
  const miniatura = await leerDataURL(mini);
  const { ancho, alto } = await dimensiones(datos);
  return { datos, miniatura, ancho, alto, bytes: full.size, original: file.size };
}

export const firestoreEvidenceStore: EvidenceStore = {
  async subir(u, file, meta) {
    const c = await comprimir(file);
    const ref = doc(collection(db, COL.evidencias));
    const batch = writeBatch(db);
    const data: Omit<Evidencia, 'id'> = {
      ...meta,
      mime: 'image/jpeg',
      ancho: c.ancho,
      alto: c.alto,
      bytes: c.bytes,
      miniatura: c.miniatura,
      subidoPor: u.id,
      creadoEn: ahoraISO(),
    };
    batch.set(ref, data);
    batch.set(doc(db, COL.evidenciasDatos, ref.id), {
      auditoriaId: meta.auditoriaId,
      participantes: meta.participantes,
      datos: c.datos,
      subidoPor: u.id,
    });
    registrarBitacora(batch, u, {
      entidad: 'evidencia',
      entidadId: ref.id,
      auditoriaId: meta.auditoriaId,
      participantes: meta.participantes,
      accion: 'crear',
      detalle: `Evidencia fotográfica agregada${meta.descripcion ? ': ' + meta.descripcion : ''}`,
    });
    await batch.commit();
    return { id: ref.id, bytes: c.bytes, original: c.original };
  },

  async obtenerImagen(id) {
    const snap = await getDoc(doc(db, COL.evidenciasDatos, id));
    return snap.exists() ? (snap.data().datos as string) : null;
  },

  async actualizarDescripcion(id, descripcion) {
    await updateDoc(doc(db, COL.evidencias, id), { descripcion });
  },

  async eliminar(u, ev) {
    await deleteDoc(doc(db, COL.evidenciasDatos, ev.id));
    const batch = writeBatch(db);
    batch.delete(doc(db, COL.evidencias, ev.id));
    registrarBitacora(batch, u, {
      entidad: 'evidencia',
      entidadId: ev.id,
      auditoriaId: ev.auditoriaId,
      participantes: ev.participantes,
      accion: 'eliminar',
      detalle: `Evidencia eliminada${ev.descripcion ? ': ' + ev.descripcion : ''}`,
    });
    await batch.commit();
  },
};

export const evidenceStore: EvidenceStore = firestoreEvidenceStore;
