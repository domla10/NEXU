import { AuthForm } from '@/features/auth/auth-form';

export const metadata = { title: 'Iniciar sesión' };

export default function LoginPage() { return <><p className="eyebrow">ACCESO A NEXU</p><h1>Iniciar sesión</h1><p className="intro">Explora cómo será el acceso a tu espacio académico.</p><AuthForm mode="login" /></>; }
