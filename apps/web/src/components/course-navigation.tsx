'use client';
import Link from 'next/link';
import { SessionPanel } from '@/features/attendance/session-panel';
import { Header } from '@/components/ui';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { DEMO_USER_ID } from '@/lib/academic/repository';

function useCourse(slug: string) {
  const revision = useDemoRevision();
  if (revision === null) return { loading: true, course: undefined, actor: DEMO_USER_ID };
  try {
    const state = browserStore.read();
    const actor = new URLSearchParams(window.location.search).get('usuario') ?? DEMO_USER_ID;
    const course = state.courses.find(c => c.slug === slug && c.status === 'active' && state.sections.some(s => s.courseId === c.id && s.status === 'active' && state.assignments.some(a => a.sectionId === s.id && a.userId === actor)));
    return { loading: false, course, actor };
  } catch { return { loading: false, course: undefined, actor: DEMO_USER_ID }; }
}

type IconName = 'qr' | 'history';
function CourseIcon({ name }: { name: IconName }) {
  return <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{name === 'qr' ? <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><path d="M14 14h3v3h-3zM20 14v3m-6 3h3m3 0v1"/></> : <><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></>}</svg>;
}

export function CoursePage({ slug }: { slug: string }) {
  const { course, actor, loading } = useCourse(slug);
  if (loading) return <p>Cargando curso de demostración…</p>;
  if (!course) return <main className="content"><p>Curso no disponible para este facilitador de demostración.</p><Link href="/docente">Volver a mis cursos</Link></main>;
  const base = `/docente/cursos/${course.slug}`;
  const query = `?usuario=${encodeURIComponent(actor)}`;
  return <><Header role="facilitador"/><main className="content course-content"><Link className="back-link" href="/docente">← <span>Mis cursos</span></Link><p className="eyebrow">CURSO DE DEMOSTRACIÓN</p><h1>{course.name}</h1><p className="course-subtitle">{course.program} · Facilitador</p><div className="course-actions"><Link className="course-action course-action-primary" href={`${base}/asistencia${query}`}><span className="action-icon"><CourseIcon name="qr"/></span><span className="action-copy"><strong>Iniciar asistencia</strong><small>Generar código QR para la clase</small></span><span className="action-arrow" aria-hidden="true">→</span></Link><Link className="course-action course-action-secondary" href={`${base}/historial${query}`}><span className="action-icon"><CourseIcon name="history"/></span><span className="action-copy"><strong>Historial de asistencia</strong><small>Consultar sesiones anteriores</small></span><span className="action-arrow" aria-hidden="true">→</span></Link></div><p className="disclaimer">Vista de demostración. Las funciones de asistencia aún no están disponibles.</p></main></>;
}

export function AttendancePage({ slug, type }: { slug: string; type: 'start' | 'history' }) {
  const { course, actor, loading } = useCourse(slug);
  if (loading) return <p>Cargando curso de demostración…</p>;
  if (!course) return <main className="content"><p>Curso no disponible para este facilitador de demostración.</p><Link href="/docente">Volver a mis cursos</Link></main>;
  const history = type === 'history';
  return <><Header role="facilitador"/><main className="content course-content"><Link className="back-link" href={`/docente/cursos/${course.slug}?usuario=${encodeURIComponent(actor)}`}>← <span>{course.name}</span></Link><p className="eyebrow">{course.name.toUpperCase()} · DEMOSTRACIÓN</p><h1>{history ? 'Historial de asistencia' : 'Iniciar asistencia'}</h1>{!history && <SessionPanel courseId={course.id} actor={actor}/>}<section className="attendance-empty"><span className="empty-icon"><CourseIcon name={history ? 'history' : 'qr'}/></span><h2>{history ? 'Historial académico completo pendiente' : 'Asistencia local de demostración'}</h2><p>{history ? 'El historial de sesiones estará disponible cuando se implemente la asistencia.' : 'El registro funciona solo dentro de este navegador.'}</p></section><p className="disclaimer">Vista de demostración. Los registros son ficticios y locales.</p></main></>;
}
