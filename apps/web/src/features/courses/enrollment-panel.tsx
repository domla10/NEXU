'use client';
import { useState } from 'react';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { EnrollmentService } from '@/lib/academic/enrollment-service';
import { DEMO_USER_ID } from '@/lib/academic/repository';

type Role = 'administrador' | 'facilitador' | 'participante';
type Props = { role: Role; actor?: string; mode?: 'inscripciones' | 'solicitudes'; courseId?: string };

export function EnrollmentPanel({ role, actor = DEMO_USER_ID, mode, courseId }: Props) {
  const revision = useDemoRevision();
  const [query, setQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('course-physics-2');
  const [selectedUser, setSelectedUser] = useState('participant-01');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (revision === null) return <p>Cargando datos de demostración…</p>;
  let state;
  try { state = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos de demostración.</p>; }
  const api = new EnrollmentService(browserStore);
  const groups = state.sections.filter(section => section.courseId === selectedCourse);
  const section = groups.length === 1 ? groups[0] : undefined;
  const admin = role === 'administrador';
  const participant = role === 'participante';
  const effectiveActor = admin ? DEMO_USER_ID : actor;
  const requests = (state.requests ?? []).filter(r => (!courseId || r.courseId === courseId) && (admin || (participant ? r.participantId === effectiveActor : state.assignments.some(a => a.userId === effectiveActor && a.sectionId === r.sectionId))));
  const memberSections = state.sections.filter(sec => (!courseId || sec.courseId === courseId) && state.assignments.some(a => a.sectionId === sec.id && a.userId === effectiveActor));
  const course = state.courses.find(c => c.id === selectedCourse);
  const enrollments = state.enrollments.filter(e => e.sectionId === section?.id);
  const alreadyEnrolled = enrollments.some(e => e.userId === selectedUser && e.status !== 'retirada');
  const directAvailable = section?.status === 'active' && course?.status === 'active';
  const participants = state.users.filter(u => u.demoParticipant && `${u.displayName} ${u.id}`.toLowerCase().includes(query.trim().toLowerCase()));
  const name = (id: string) => state.users.find(u => u.id === id)?.displayName ?? 'Usuario ficticio';
  const sectionName = (id: string) => state.courses.find(c => c.id === state.sections.find(sec => sec.id === id)?.courseId)?.name ?? 'Curso';

  async function run(question: string, success: string, action: () => Promise<{ ok: boolean; error?: string }>) {
    if (!confirm(question)) return;
    setBusy(true);
    try {
      const result = await action();
      setMessage(result.ok ? success : result.error ?? 'No se pudo completar la operación.');
    } catch { setMessage('No se pudo guardar en este navegador.'); }
    finally { setBusy(false); }
  }

  return <section className="tool-panel">
    <h2>{admin ? 'Gestión de inscripciones' : participant ? 'Catálogo y solicitudes' : 'Solicitudes e inscritos'}</h2>
    <p>Datos ficticios guardados solo en este navegador.</p>
    <p className="feedback" role="status">{message}</p>
    {participant && <>
      <h3>Catálogo de cursos</h3>
      <div className="record-list">{state.sections.filter(sec => state.sections.filter(group => group.courseId === sec.courseId).length === 1).map(sec => {
        const catalogCourse = state.courses.find(c => c.id === sec.courseId);
        const facilitator = state.assignments.find(a => a.sectionId === sec.id);
        const enrolled = state.enrollments.some(e => e.userId === actor && e.sectionId === sec.id && e.status !== 'retirada');
        const pending = requests.some(r => r.sectionId === sec.id && r.status === 'pendiente');
        const available = sec.status === 'active' && catalogCourse?.status === 'active' && !!facilitator;
        return <article className="course" key={sec.id}>
          <strong>{catalogCourse?.name}</strong><p>{catalogCourse?.code} · {facilitator ? name(facilitator.userId) : 'Sin facilitador'}</p>
          <p>{enrolled ? 'Inscrito' : pending ? 'Solicitud pendiente' : available ? 'Disponible' : 'No disponible'}</p>
          <button className="button secondary" type="button" disabled={busy || !available || enrolled || pending}
            onClick={() => run(`¿Solicitar inscripción en ${catalogCourse?.name}?`, 'Solicitud de inscripción enviada.', () => api.request(actor, sec.id))}>Solicitar inscripción</button>
        </article>;
      })}</div>
    </>}
    {admin && mode !== 'solicitudes' && <>
      <h3>Inscripción directa</h3>
      <form onSubmit={event => {
        event.preventDefault();
        if (section && selectedUser && !alreadyEnrolled && directAvailable) void run(`¿Inscribir a ${name(selectedUser)} en ${course?.name}?`, 'Participante inscrito.', () => api.direct(effectiveActor, selectedUser, section.id));
      }}>
        <div className="field"><label htmlFor="member-search">Buscar participante</label>
          <input id="member-search" type="search" value={query} onChange={e => { setQuery(e.target.value); setSelectedUser(''); setMessage(''); }}/>
        </div>
        <div className="field"><label htmlFor="member">Participante</label>
          <select id="member" required value={selectedUser} onChange={e => { setSelectedUser(e.target.value); setMessage(''); }}>
            <option value="">{participants.length ? 'Selecciona un participante' : 'Sin coincidencias'}</option>
            {participants.map(u => <option key={u.id} value={u.id}>{u.displayName} · {u.id}</option>)}
          </select>
        </div>
        <div className="field"><label htmlFor="section-select">Curso</label>
          <select id="section-select" value={selectedCourse} onChange={e => { setSelectedCourse(e.target.value); setMessage(''); }}>
            {state.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        {!section ? <p>Este curso tiene grupos históricos que requieren revisión.</p> : !directAvailable ? <p>Este curso no admite inscripciones.</p> : alreadyEnrolled && <p>El participante ya está inscrito.</p>}
        <button type="submit" className="button primary" disabled={busy || !selectedUser || !directAvailable || alreadyEnrolled}>Inscribir</button>
      </form>
      <h3>Inscripciones</h3>
      {enrollments.length ? <ul className="member-list">{enrollments.map((e, index) => <li key={index}>
        <span>{name(e.userId)} · {e.status === 'retirada' ? 'Retirada' : 'Activa'}</span>
        {e.status !== 'retirada' && <button type="button" className="button danger" disabled={busy}
          onClick={() => run(`¿Retirar la inscripción de ${name(e.userId)} en ${course?.name}?`, 'Inscripción retirada.', () => api.withdraw(effectiveActor, e.userId, e.sectionId))}>Retirar</button>}
      </li>)}</ul> : <p>No hay inscripciones en este curso.</p>}
    </>}
    {role === 'facilitador' && <>
      <h3>Participantes inscritos</h3>
      {memberSections.length ? memberSections.map(sec => {
        const members = state.enrollments.filter(e => e.sectionId === sec.id && e.status !== 'retirada');
        return <article className="course" key={sec.id}><strong>{sectionName(sec.id)}</strong>
          {members.length ? members.map(e => <p key={e.userId}>{name(e.userId)}</p>) : <p>Sin participantes inscritos.</p>}
        </article>;
      }) : <p>No hay cursos asignados.</p>}
    </>}
    {mode !== 'inscripciones' && <>
      <h3>{participant ? 'Mis solicitudes' : 'Solicitudes recibidas'}</h3>
      {!requests.length && <p>No hay solicitudes.</p>}
      <div className="record-list">{requests.map(r => {
        const context = `${name(r.participantId)} en ${sectionName(r.sectionId)}`;
        return <article className="course" key={r.id}><strong>{sectionName(r.sectionId)}</strong>
          <p>{name(r.participantId)} · {r.status} · {r.origin === 'qr' ? 'QR' : 'Catálogo'} · {new Date(r.createdAt).toLocaleDateString('es')}</p>
          {r.status === 'pendiente' && <div className="control-row">{participant
            ? <button type="button" className="button danger" disabled={busy} onClick={() => run(`¿Cancelar tu solicitud para ${sectionName(r.sectionId)}?`, 'Solicitud cancelada.', () => api.resolve(effectiveActor, r.id, 'cancelada'))}>Cancelar</button>
            : <><button type="button" className="button primary" disabled={busy} onClick={() => run(`¿Aprobar la solicitud e inscribir a ${context}?`, 'Solicitud aprobada. Participante inscrito.', () => api.resolve(effectiveActor, r.id, 'aprobada'))}>Aprobar</button>
              <button type="button" className="button danger" disabled={busy} onClick={() => run(`¿Rechazar la solicitud de ${context}?`, 'Solicitud rechazada.', () => api.resolve(effectiveActor, r.id, 'rechazada'))}>Rechazar</button></>}
          </div>}
        </article>;
      })}</div>
    </>}
  </section>;
}
