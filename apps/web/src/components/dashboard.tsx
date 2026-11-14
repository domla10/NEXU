import { demoCourses } from '@/lib/demo-courses';
import { CourseCard, Header } from './ui';

export function Dashboard({ role }: { role: 'facilitador' | 'participante' }) {
  const participant = role === 'participante';
  return (
    <>
      <Header role={role} />
      <main className="content dashboard">
        <div className="title-row">
          <div><p className="eyebrow">PANEL DE {role.toUpperCase()}</p><h1>Mis cursos</h1></div>
          <span className="demo-badge">Demostración</span>
        </div>
        <p className="intro">Curso provisional para el piloto.</p>
        <div className="course-list">
          {demoCourses.map((course) => <CourseCard key={`${course.institution}-${course.campus}-${course.name}`} course={course} />)}
        </div>
        <aside className="notice" aria-label="Próximamente">
          <span className="notice-icon" aria-hidden="true">◷</span>
          <div><strong>Próximamente</strong><p>{participant ? 'Registro de asistencia mediante QR.' : 'Gestión de asistencia del curso.'}</p></div>
        </aside>
        <p className="disclaimer">Demostración con datos ficticios. No se registra asistencia.</p>
      </main>
    </>
  );
}
