import { Component, type ErrorInfo, type ReactNode } from 'react';
import { AlertTriangle, MessageSquarePlus, RotateCcw } from 'lucide-react';
import { abrirReporte, registrarError } from '../../lib/errores';
import { Button } from '../ui';

/**
 * Si una pantalla falla al dibujarse, muestra un aviso amable (en vez de una página en blanco),
 * registra el error y ofrece recargar o contar qué pasó. Se reinicia al cambiar de página (prop "clave").
 */
export class ErrorBoundary extends Component<{ children: ReactNode; clave?: string }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    registrarError('render', error, (info.componentStack ?? '').trim().split('\n').slice(0, 3).join(' ← '));
  }

  componentDidUpdate(prev: { clave?: string }) {
    if (prev.clave !== this.props.clave && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="card mx-auto mt-8 max-w-lg p-6 text-center">
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 text-red-600"><AlertTriangle className="h-6 w-6" /></span>
        <h2 className="mt-3 text-lg font-bold text-zinc-900">Ocurrió un problema en esta pantalla</h2>
        <p className="mt-1 text-sm text-zinc-600">Ya quedó registrado para el administrador. Tus datos guardados no se pierden.</p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Button variant="primary" icon={<RotateCcw className="h-4 w-4" />} onClick={() => location.reload()}>Recargar</Button>
          <Button icon={<MessageSquarePlus className="h-4 w-4" />} onClick={() => abrirReporte(this.state.error?.message ?? '')}>Contar qué pasó</Button>
        </div>
      </div>
    );
  }
}
