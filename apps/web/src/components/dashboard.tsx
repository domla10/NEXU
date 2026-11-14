import Link from 'next/link';
import { demoCourses } from '@/lib/demo-courses';
import type { AcademicRole } from '@/types/academic';
import { CourseCard, Header } from './ui';

type PendingItem = { title: string; description: string };
const participantItems: PendingItem[] = [
  { title: 'Historial de asistencia', description: 'Aún no hay registros. El control de asistencia está pendiente.' },
  { title: 'Registro con QR', description: 'La lectura y el registro de asistencia mediante QR estarán disponibles próximamente.' },
];
const facilitatorItems: PendingItem[] = [
  { title: 'Participantes inscritos', description: 'Aún no hay listas disponibles. La gestión de participantes está pendiente.' },
];
export function Dashboard({ role }: { role: AcademicRole }) {
  const participant = role === 'participante';
  const items = participant ? participantItems : facilitatorItems;
  return <><Header role={role} /><main className="content dashboard"><div className="title-row"><div><p className="eyebrow">PANEL DE {role.toUpperCase()}</p><h1>Mis cursos</h1></div><span className="demo-badge">Demostración</span></div><p className="intro">Vista de {role} · Sin sesión iniciada. Los datos son ficticios.</p><div className="profile-summary"><strong>Perfil de demostración</strong><p>{participant ? 'Participante' : 'Facilitador'} · Sin cuenta vinculada</p><Link href={participant ? '/docente' : '/estudiante'}>Ver panel de {participant ? 'facilitador' : 'participante'} →</Link></div><h2 className="section-title">{participant ? 'Cursos inscritos' : 'Cursos asignados'}</h2><p className="section-description">Ejemplo provisional; no representa una inscripción o asignación real.</p><div className="course-list">{demoCourses.length ? demoCourses.map(course => <CourseCard key={`${course.institution}-${course.campus}-${course.name}`} course={course} navigable={!participant} />) : <p className="empty-state">No hay cursos para mostrar en esta demostración.</p>}</div><h2 className="section-title">Actividad académica</h2><div className="pending-list">{items.map(item => <section className="pending-card" key={item.title}><div className="pending-heading"><h3>{item.title}</h3><span>Pendiente</span></div><p>{item.description}</p></section>)}</div><p className="disclaimer">Esta demostración no registra datos ni concede permisos. Los roles reales se validarán en el servidor.</p></main></>;
}
