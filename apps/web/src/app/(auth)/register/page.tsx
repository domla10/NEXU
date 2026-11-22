import { AuthForm } from '@/features/auth/auth-form';

export const metadata = { title: 'Crear cuenta' };

export default function RegisterPage() { return <><p className="eyebrow">ACCESO A NEXU</p><h1>Crear cuenta</h1><p className="intro">El registro estará disponible cuando se conecte el servicio de identidad.</p><AuthForm mode="register" /></>; }
