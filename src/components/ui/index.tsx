import { useEffect, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type TextareaHTMLAttributes, type SelectHTMLAttributes } from 'react';
import { Loader2, X } from 'lucide-react';
import { cn } from '../../lib/utils';

// ---------------- Button ----------------
type Variant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'dark';
const variants: Record<Variant, string> = {
  primary: 'bg-brand text-ink hover:bg-brand-dark font-semibold',
  dark: 'bg-panel text-white hover:bg-panel-hover',
  secondary: 'border border-zinc-300 bg-surface text-zinc-800 hover:bg-zinc-50',
  ghost: 'text-zinc-700 hover:bg-zinc-100',
  danger: 'bg-red-600 text-white hover:bg-red-700',
};

export function Button({
  variant = 'secondary',
  size = 'md',
  loading,
  icon,
  className,
  children,
  disabled,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; size?: 'sm' | 'md'; loading?: boolean; icon?: ReactNode }) {
  return (
    <button
      {...rest}
      disabled={disabled || loading}
      className={cn(
        'inline-flex items-center justify-center gap-1.5 rounded-md transition disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3.5 py-2 text-sm',
        variants[variant],
        className,
      )}
    >
      {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}

// ---------------- Campos ----------------
/** Campo con etiqueta. `error`: resalta el campo con un pulso rojo y muestra qué falta justo debajo. */
export function Field({ label, children, hint, className, error }: { label: string; children: ReactNode; hint?: string; className?: string; error?: string | null }) {
  return (
    <label className={cn('block', className)} data-campo-error={error ? '' : undefined}>
      <span className={cn('label', error && '!text-red-700')}>{label}{error && ' *'}</span>
      <span className={cn('block', error && 'campo-error')}>{children}</span>
      {error ? (
        <span className="mt-1 block text-xs font-semibold text-red-700" role="alert">{error}</span>
      ) : (
        hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>
      )}
    </label>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={cn('input', p.className)} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
  <textarea rows={3} {...p} className={cn('input resize-y', p.className)} />
);
export function Select({ options, placeholder, ...p }: SelectHTMLAttributes<HTMLSelectElement> & { options: { value: string; label: string }[]; placeholder?: string }) {
  return (
    <select {...p} className={cn('input', p.className)}>
      {placeholder !== undefined && <option value="">{placeholder}</option>}
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

export function CheckboxGroup<T extends string>({ options, value, onChange, disabled }: { options: { value: T; label: string }[]; value: T[]; onChange: (v: T[]) => void; disabled?: boolean }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = value.includes(o.value);
        return (
          <button
            type="button"
            key={o.value}
            disabled={disabled}
            onClick={() => onChange(on ? value.filter((v) => v !== o.value) : [...value, o.value])}
            className={cn(
              'rounded-full border px-3 py-1 text-xs transition disabled:opacity-50',
              on ? 'border-panel bg-panel text-white' : 'border-zinc-300 bg-surface text-zinc-700 hover:border-zinc-500',
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

// ---------------- Card / layout ----------------
export function Card({ title, actions, children, className }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={cn('card min-w-0', className)}>
      {(title || actions) && (
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-zinc-100 px-4 py-3">
          <h3 className="text-sm font-semibold text-zinc-800">{title}</h3>
          <div className="flex flex-wrap gap-2">{actions}</div>
        </header>
      )}
      <div className="flex-1 p-4">{children}</div>
    </section>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-bold text-zinc-900">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Badge({ children, className }: { children: ReactNode; className?: string }) {
  return <span className={cn('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-semibold', className)}>{children}</span>;
}

export function Spinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 p-8 text-sm text-zinc-500">
      <Loader2 className="h-5 w-5 animate-spin" /> {label}
    </div>
  );
}

export function EmptyState({ title, children, action }: { title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-zinc-300 bg-surface p-8 text-center">
      <p className="font-semibold text-zinc-700">{title}</p>
      {children && <p className="max-w-md text-sm text-zinc-500">{children}</p>}
      {action}
    </div>
  );
}

export function Alerta({ tipo = 'warn', children }: { tipo?: 'warn' | 'error' | 'info'; children: ReactNode }) {
  const c = { warn: 'border-amber-300 bg-amber-50 text-amber-900', error: 'border-red-300 bg-red-50 text-red-900', info: 'border-sky-300 bg-sky-50 text-sky-900' }[tipo];
  return <div className={cn('rounded-lg border px-3 py-2 text-sm', c)}>{children}</div>;
}

export function ErrorList({ errores }: { errores: string[] }) {
  if (!errores.length) return null;
  return (
    <Alerta tipo="error">
      <ul className="list-inside list-disc space-y-0.5">
        {errores.map((e) => (
          <li key={e}>{e}</li>
        ))}
      </ul>
    </Alerta>
  );
}

// ---------------- Modal ----------------
export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' | 'xl' }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);
  if (!open) return null;
  const w = { md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' }[size];
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 sm:items-center sm:p-4" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" className={cn('flex max-h-[92vh] w-full flex-col rounded-t-2xl bg-surface shadow-xl sm:rounded-2xl', w)} onMouseDown={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between border-b border-zinc-100 px-5 py-3">
          <h2 className="font-semibold">{title}</h2>
          <button onClick={onClose} aria-label="Cerrar" className="rounded p-1 text-zinc-500 hover:bg-zinc-100">
            <X className="h-5 w-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap justify-end gap-2 border-t border-zinc-100 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  );
}
