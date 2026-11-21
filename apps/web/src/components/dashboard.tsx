'use client';
import Link from 'next/link';
import { useState } from 'react';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { DemoScanner } from '@/features/attendance/scanner';
import { EnrollmentPanel } from '@/features/courses/enrollment-panel';
import { DEMO_USER_ID } from '@/lib/academic/repository';
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
  const [actor, setActor] = useState(DEMO_USER_ID);
  const participant = role === 'participante';
  const items = participant ? participantItems : facilitatorItems;
  const revision = useDemoRevision();
  if (revision === null) return <><Header role={role}/><main className="content"><p>Cargando datos de demostración…</p></main></>;
  let state;
  try { state = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos de demostración.</p>; }
  const links = participant ? state.enrollments.filter(e => e.status !== 'retirada') : state.assignments;
  const visibleCourses = state.courses.filter(c => c.status === 'active' && state.sections.some(s => s.courseId === c.id && s.status === 'active' && links.some(a => a.sectionId === s.id && a.userId === actor)));
  return <><Header role={role} /><main className="content dashboard"><div className="title-row"><div><p className="eyebrow">PANEL DE {role.toUpperCase()}</p><h1>Mis cursos</h1></div><span className="demo-badge">Demostración</span></div><p className="intro">Vista de {role} · Sin sesión iniciada. Los datos son ficticios.</p><div className="profile-summary"><strong>Perfil de demostración</strong><p>{participant ? 'Participante' : 'Facilitador'} · Sin cuenta vinculada</p><Link href={participant ? '/docente' : '/estudiante'}>Ver panel de {participant ? 'facilitador' : 'participante'} →</Link></div><h2 className="section-title">{participant ? 'Cursos inscritos' : 'Cursos asignados'}</h2><p className="section-description">Ejemplo provisional; no representa una inscripción o asignación real.</p><div className="course-list">{visibleCourses.length ? visibleCourses.map(course => <CourseCard key={`${course.institution}-${course.campus}-${course.name}`} course={course} navigable={!participant} userId={actor} />) : <p className="empty-state">No hay cursos para mostrar en esta demostración.</p>}</div>{participant ? <><EnrollmentPanel role={role} actor={actor} onActorChange={setActor}/><DemoScanner actor={actor}/></> : <div className="field"><label htmlFor="actor-facilitador">Facilitador de demostración</label><select id="actor-facilitador" value={actor} onChange={e => setActor(e.target.value)}>{state.users.filter(u => u.demoFacilitator).map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></div>}{participant && <><h2 className="section-title">Actividad académica</h2><div className="pending-list">{items.map(item => <section className="pending-card" key={item.title}><div className="pending-heading"><h3>{item.title}</h3><span>Pendiente</span></div><p>{item.description}</p></section>)}</div></>}<p className="disclaimer">Esta demostración guarda datos ficticios locales y no concede permisos reales. Los roles reales se validarán en el servidor.</p></main></>;
}
