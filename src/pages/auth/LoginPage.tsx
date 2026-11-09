import { useState, type FormEvent } from 'react';
import { ArrowRight } from 'lucide-react';
import { Alerta, Button, Field, Input } from '../../components/ui';
import { AuthShell } from '../../components/layout/AuthShell';
import { useAuth } from '../../context/AuthContext';
import { errorMensaje } from '../../lib/utils';

export default function LoginPage() {
  const { login, resetPassword } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setInfo('');
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(errorMensaje(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell>
      <h1>Iniciar sesión</h1>
      <p className="sub">Usa el correo y la contraseña de tu cuenta de auditor.</p>
      <form onSubmit={onSubmit} className="mt-7 space-y-4">
        <Field label="Correo corporativo">
          <Input type="email" autoComplete="username" required placeholder="nombre@fma.cl" value={email} onChange={(e) => setEmail(e.target.value)} className="py-2.5 text-base" />
        </Field>
        <Field label="Contraseña">
          <Input type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className="py-2.5 text-base" />
        </Field>
        {error && <Alerta tipo="error">{error}</Alerta>}
        {info && <Alerta tipo="info">{info}</Alerta>}
        <Button type="submit" variant="primary" className="w-full py-3 text-base shadow-[0_0_24px_-6px_rgba(245,196,0,.7)]" loading={loading}>
          Entrar <ArrowRight className="h-4 w-4" />
        </Button>
        <button
          type="button"
          className="w-full text-center text-sm text-zinc-500 underline-offset-4 hover:text-zinc-900 hover:underline"
          onClick={async () => {
            setError('');
            if (!email) return setError('Escribe tu correo y te enviamos un enlace para restablecer la contraseña.');
            try {
              await resetPassword(email);
              setInfo('Listo: revisa tu correo para restablecer la contraseña.');
            } catch (err) {
              setError(errorMensaje(err));
            }
          }}
        >
          ¿Olvidaste tu contraseña?
        </button>
      </form>
    </AuthShell>
  );
}
