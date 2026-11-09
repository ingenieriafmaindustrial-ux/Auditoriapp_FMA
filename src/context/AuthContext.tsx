import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
  sendPasswordResetEmail,
  type User,
} from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../lib/firebase';
import type { Usuario } from '../types';
import { COL } from '../services/base';

export type EstadoSesion = 'cargando' | 'anonimo' | 'setup' | 'sin_perfil' | 'inactivo' | 'listo';

interface AuthValue {
  estado: EstadoSesion;
  firebaseUser: User | null;
  usuario: Usuario | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [usuario, setUsuario] = useState<Usuario | null>(null);
  const [estado, setEstado] = useState<EstadoSesion>('cargando');

  useEffect(() => onAuthStateChanged(auth, (u) => {
    setFirebaseUser(u);
    if (!u) {
      setUsuario(null);
      setEstado('anonimo');
    } else {
      setEstado('cargando');
    }
  }), []);

  useEffect(() => {
    if (!firebaseUser) return;
    const unsub = onSnapshot(
      doc(db, COL.usuarios, firebaseUser.uid),
      async (snap) => {
        if (snap.exists()) {
          const u = { id: snap.id, ...snap.data() } as Usuario;
          setUsuario(u);
          setEstado(u.activo ? 'listo' : 'inactivo');
          return;
        }
        setUsuario(null);
        try {
          const cfg = await getDoc(doc(db, COL.config, 'app'));
          setEstado(cfg.exists() ? 'sin_perfil' : 'setup');
        } catch {
          setEstado('sin_perfil');
        }
      },
      () => setEstado('sin_perfil'),
    );
    return unsub;
  }, [firebaseUser]);

  const value: AuthValue = {
    estado,
    firebaseUser,
    usuario,
    login: async (email, password) => {
      await signInWithEmailAndPassword(auth, email.trim(), password);
    },
    logout: () => signOut(auth),
    resetPassword: (email) => sendPasswordResetEmail(auth, email.trim()),
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return ctx;
}

/** Para páginas protegidas: garantiza usuario cargado. */
export function useUsuario(): Usuario {
  const { usuario } = useAuth();
  if (!usuario) throw new Error('Sesión no disponible');
  return usuario;
}
