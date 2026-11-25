import { deleteDoc, doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ahoraISO } from '../lib/dates';
import type { Firma } from '../lib/firmas';
import type { Usuario } from '../types';
import { COL } from './base';

/** Guarda (o reemplaza) la firma del propio usuario. Documento = uid; el nombre se toma del perfil. */
export async function guardarMiFirma(u: Usuario, f: Firma) {
  await setDoc(doc(db, COL.firmas, u.id), { nombre: u.nombre, dataUrl: f.dataUrl, ancho: f.ancho, alto: f.alto, actualizadoEn: ahoraISO() });
}

export async function eliminarMiFirma(u: Usuario) {
  await deleteDoc(doc(db, COL.firmas, u.id));
}
