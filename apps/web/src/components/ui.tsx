import Link from 'next/link';
import type { Course } from '@/types/academic';

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

export function CourseCard({ course, navigable = false, userId }: { course: Course; navigable?: boolean; userId?: string }) {
  const details = <><span className="course-label">{course.isPilot ? 'CURSO PILOTO PROVISIONAL' : 'CURSO DE DEMOSTRACIÓN'}</span><h2>{course.name}</h2><p className="program">{course.program}</p><p className="institution">{course.institution} · {course.campus}</p></>;
  if (!navigable) return <article className="course enrolled-course">
    <h3>{course.name}</h3>
    <p>{course.code} · {course.program}</p>
  </article>;
  return <Link className="course course-link" href={`/docente/cursos/${course.slug}${userId ? `?usuario=${encodeURIComponent(userId)}` : ''}`}><span className="course-link-icon" aria-hidden="true"><AcademicIcon /></span><div className="course-link-details">{details}</div><span className="course-link-arrow" aria-hidden="true">→</span></Link>;
}

export function AcademicIcon() {
  return <svg width="23" height="23" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="m2 9 10-5 10 5-10 5L2 9Z"/><path d="M6 11v5c3 3 9 3 12 0v-5M22 9v6"/></svg>;
}
