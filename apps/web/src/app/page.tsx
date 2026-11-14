import Link from 'next/link';
import { Header } from '@/components/ui';
export default function Home() {
  return <><Header /><main className="content welcome"><p className="eyebrow">ESPACIO ACADÉMICO</p><h1>Bienvenido a NEXU</h1><p className="intro">Una plataforma de apoyo para organizar la asistencia y la actividad académica.</p> 
   aria-hidden="true" className="actions"><Link className="button primary" href="/login">Iniciar sesión <span aria-hidden="true">→</span></Link><Link className="button secondary" href="/register">Crear cuenta <span aria-hidden="true">→</span></Link></div><div className="demo-section"><p className="choice-label">Explorar paneles de demostración</p><p className="intro">Vistas públicas con información ficticia. No requieren inicio de sesión.</p><div className="demo-links"><Link href="/estudiante">Participante <span aria-hidden="true">→</span></Link><Link href="/docente">Facilitador <span aria-hidden="true">→</span></Link></div></div></main></>;
}
