import Link from 'next/link';
import { notFound } from 'next/navigation';
import { Header } from '@/components/ui';
import { demoRepository, DEMO_USER_ID } from '@/lib/academic/repository';

export const courseParams = async () => (await demoRepository.listCoursesForUser(DEMO_USER_ID, 'facilitador')).map(({ slug }) => ({ curso: slug }));
export async function getCourse(slug: string) {
  const course = await demoRepository.findCourseBySlug(slug);
  if (!course || !(await demoRepository.hasCoursePermission(DEMO_USER_ID, course.id, 'manage_course'))) notFound();
  return course;
}

type IconName = 'qr' | 'history';
function CourseIcon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'qr' ? <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3m-6 3h3m3 0v1"/></> : <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}</svg>;
}

export async function CoursePage({ slug }: { slug: string }) {
  const course = await getCourse(slug);
  const base = `/docente/cursos/${course.slug}`;
  return <><Header role="facilitador"/><main className="content course-content"><Link className="back-link" href="/docente">← <span>Mis cursos</span></Link><p className="eyebrow">CURSO DE DEMOSTRACIÓN</p><h1>{course.name}</h1><p className="course-subtitle">{course.program} · Facilitador</p><div className="course-actions"><Link className="course-action course-action-primary" href={`${base}/asistencia`}><span className="action-icon"><CourseIcon name="qr"/></span><span className="action-copy"><strong>Iniciar asistencia</strong><small>Generar código QR para la clase</small></span><span className="action-arrow" aria-hidden="true">→</span></Link><Link className="course-action course-action-secondary" href={`${base}/historial`}><span className="action-icon"><CourseIcon name="history"/></span><span className="action-copy"><strong>Historial de asistencia</strong><small>Consultar sesiones anteriores</small></span><span className="action-arrow" aria-hidden="true">→</span></Link></div><p className="disclaimer">Vista de demostración. Las funciones de asistencia aún no están disponibles.</p></main></>;
}

export async function AttendancePage({ slug, type }: { slug: string; type: 'start' | 'history' }) {
  const course = await getCourse(slug);
  const history = type === 'history';
  return <><Header role="facilitador"/><main className="content course-content"><Link className="back-link" href={`/docente/cursos/${course.slug}`}>← <span>{course.name}</span></Link><p className="eyebrow">{course.name.toUpperCase()} · DEMOSTRACIÓN</p><h1>{history ? 'Historial de asistencia' : 'Iniciar asistencia'}</h1><section className="attendance-empty"><span className="empty-icon"><CourseIcon name={history ? 'history' : 'qr'}/></span><h2>{history ? 'Sin sesiones registradas' : 'Generación de QR no disponible'}</h2><p>{history ? 'El historial de sesiones estará disponible cuando se implemente la asistencia.' : 'La generación de códigos QR para la clase estará disponible próximamente.'}</p></section><p className="disclaimer">Vista de demostración. No se registran asistencias reales.</p></main></>;
}
