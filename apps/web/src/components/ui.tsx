import Link from 'next/link';
import type { DemoCourse } from '@/lib/demo-courses';

export function Header({ role, home = false }: { role?: 'facilitador' | 'participante'; home?: boolean }) {
  return (
    <header className="header">
      <div className="header-inner">
        <Link href="/" className="brand" aria-label="NEXU, ir al inicio">
          <span className="brand-mark" aria-hidden="true">N</span>
          <span>NEXU<small>ESPACIO ACADÉMICO</small></span>
        </Link>
        <nav aria-label="Navegación principal">
          <Link href="/" aria-current={home ? 'page' : undefined}>Inicio</Link>
          {role && <span className="nav-current" aria-current="page">{role === 'facilitador' ? 'Facilitador' : 'Participante'}</span>}
        </nav>
      </div>
    </header>
  );
}

export function CourseCard({ course }: { course: DemoCourse }) {
  return (
    <article className="course">
      <span className="course-label">CURSO PILOTO PROVISIONAL</span>
      <h2>{course.name}</h2>
      <p className="program">{course.program}</p>
      <p className="institution">{course.institution} · {course.campus}</p>
    </article>
  );
}
