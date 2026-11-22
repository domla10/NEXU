'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { DemoScanner } from '@/features/attendance/scanner';
import { EnrollmentPanel } from '@/features/courses/enrollment-panel';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import type { AttendanceState } from '@/lib/academic/attendance-service';
import { DEMO_USER_ID } from '@/lib/academic/repository';
import type { AcademicRole } from '@/types/academic';
import { CourseCard, Header } from './ui';

function ParticipantAttendance({ state, actor }: { state: AttendanceState; actor: string }) {
  const records = (state.attendance ?? []).filter(record => record.participantId === actor).reverse();
  if (!records.length) return <p className="empty-state">Aún no tienes asistencias registradas en este navegador.</p>;
  return <ul className="course-list">{records.map(record => {
    const session = state.sessions?.find(item => item.id === record.sessionId);
    const course = state.courses.find(item => item.id === session?.courseId);
    return <li key={record.id} className="course">
      <strong>{course?.name ?? 'Curso de demostración'}</strong>
      <p><time dateTime={record.recordedAt}>{new Date(record.recordedAt).toLocaleString('es')}</time> · QR de demostración</p>
    </li>;
  })}</ul>;
}

export function Dashboard({ role }: { role: AcademicRole }) {
  const loading = <p role="status">Cargando datos de demostración…</p>;
  return <><Header role={role} currentPanel/><main className="content dashboard">
    <Suspense fallback={loading}><DashboardContent role={role}/></Suspense>
  </main></>;
}

function DashboardContent({ role }: { role: AcademicRole }) {
  const requestedActor = useSearchParams().get('usuario');
  const revision = useDemoRevision();
  if (revision === null) return <p role="status">Cargando datos de demostración…</p>;
  let state: AttendanceState;
  try { state = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos de demostración.</p>; }

  const participant = role === 'participante';
  const profiles = state.users.filter(user => participant ? user.demoParticipant : user.demoFacilitator);
  function selectActor(id: string) {
    const url = new URL(window.location.href);
    url.searchParams.set('usuario', id);
    window.history.replaceState(null, '', url);
  }
  const actor = profiles.find(profile => profile.id === requestedActor)?.id ?? DEMO_USER_ID;
  const links = participant ? state.enrollments.filter(row => row.status !== 'retirada') : state.assignments;
  const visibleCourses = state.courses.filter(course => course.status === 'active' && state.sections.some(group =>
    group.courseId === course.id && group.status === 'active' && links.some(row => row.sectionId === group.id && row.userId === actor)
  ));
  return <>
    <div className="title-row"><div><p className="eyebrow">PANEL DE {role.toUpperCase()}</p><h1>Mis cursos</h1></div><span className="demo-badge">Demostración</span></div>
    <p className="intro">Datos ficticios guardados en este navegador. Sin sesión iniciada.</p>
    <div className="profile-summary">
      <div className="field">
        <label htmlFor={`actor-${role}`}>{participant ? 'Participante' : 'Facilitador'} de demostración</label>
        <select id={`actor-${role}`} value={actor} onChange={event => selectActor(event.target.value)}>
          {profiles.map(user => <option key={user.id} value={user.id}>{user.displayName}</option>)}
        </select>
      </div>
    </div>
    <h2 className="section-title">{participant ? 'Cursos inscritos' : 'Cursos asignados'}</h2>
    <div className="course-list">{visibleCourses.length
      ? visibleCourses.map(course => <CourseCard key={course.id} course={course} navigable={!participant} userId={actor}/>)
      : <p className="empty-state">No hay cursos para mostrar en esta demostración.</p>}</div>
    {participant && <div className="participant-tools" key={actor}>
      <details><summary>Catálogo y solicitudes de inscripción</summary><EnrollmentPanel role="participante" actor={actor}/></details>
      <ScannerDisclosure actor={actor}/>
      <details><summary>Historial de asistencia</summary><ParticipantAttendance state={state} actor={actor}/></details>
    </div>}
    <Link className="back-link context-link" href={participant ? '/docente' : '/estudiante'}>Ver panel de {participant ? 'facilitador' : 'participante'} <span aria-hidden="true">→</span></Link>
  </>;
}

function ScannerDisclosure({ actor }: { actor: string }) {
  const [open, setOpen] = useState(false);
  return <details onToggle={event => setOpen(event.currentTarget.open)}>
    <summary>Escanear QR</summary>{open && <DemoScanner actor={actor}/>}
  </details>;
}
