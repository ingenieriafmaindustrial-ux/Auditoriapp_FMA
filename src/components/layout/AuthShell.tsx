import type { ReactNode } from 'react';
import { MotionGrid } from '../ui/motion-grid';

/**
 * Pantallas de acceso: fondo con la grilla animada del banner + tarjeta de vidrio con borde de luz.
 * Siempre en paleta oscura (tema-oscuro) para mantener el look tecnológico.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="auth tema-oscuro">
      <MotionGrid speed="4s" opacity={0.14} enableGlow lineColor="56, 189, 248" cellSize={42} className="auth-bg" />
      <span className="auth-orb o1" aria-hidden="true" />
      <span className="auth-orb o2" aria-hidden="true" />

      <section className="auth-brand">
        <img src="/logo-app.png" alt="FMA AuditoriAPP" className="auth-logo" />
        <p className="auth-kicker">Sistema Integrado de Gestión</p>
        <h2 className="auth-title">
          Auditorías <span>internas</span>
          <br />
          en tiempo real
        </h2>
        <p className="auth-lead">Planifica, audita en terreno, registra hallazgos, sigue las acciones correctivas y emite el informe desde un solo lugar.</p>
        <div className="auth-stats">
          <div className="auth-stat"><b>3</b><span>Normas ISO</span></div>
          <div className="auth-stat"><b>168</b><span>Cláusulas</span></div>
          <div className="auth-stat"><b>100%</b><span>Trazable</span></div>
        </div>
        <div className="auth-foot">
          <img src="/logo-fma.png" alt="" /> FMA Industrial Chile · ISO 9001 · 14001 · 45001
        </div>
      </section>

      <main className="auth-card">
        <span className="auth-hud" aria-hidden="true" />
        <p className="auth-status"><i /> Conexión segura · Firebase</p>
        {children}
      </main>
    </div>
  );
}
