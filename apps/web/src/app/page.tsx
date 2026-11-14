import Link from 'next/link';
import { Header } from '@/components/ui';
import { demoCourses } from '@/lib/demo-courses';

export default function Home() {
  return (
    <>
      <Header />
      <main className="content welcome">
        <p className="eyebrow">ESPACIO ACADÉMICO</p>
        <h1>Bienvenido a NEXU</h1>
        <p className="intro">Una plataforma de apoyo a la gestión académica y la asistencia.</p>
        <div className="pilot-summary"><span>CURSO PILOTO PROVISIONAL</span><strong>{demoCourses[0].name}</strong><p>{demoCourses[0].program}<br />{demoCourses[0].institution} · {demoCourses[0].campus}</p></div>
        <p className="choice-label">Selecciona tu perfil</p>
        <div className="actions">
          <Link className="button primary" href="/docente">Entrar como facilitador <span aria-hidden="true">→</span></Link>
          <Link className="button secondary" href="/estudiante">Entrar como participante <span aria-hidden="true">→</span></Link>
        </div>
        <p className="disclaimer">Modo demostración · Datos ficticios</p>
      </main>
    </>
  );
}
