'use client';
import { useState } from 'react';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { EnrollmentService } from '@/lib/academic/enrollment-service';
import { DEMO_USER_ID } from '@/lib/academic/repository';

export function EnrollmentPanel({ role, actor, onActorChange, mode, courseId }: { role: 'administrador' | 'facilitador' | 'participante'; actor?: string; onActorChange?: (id: string) => void; mode?: 'inscripciones' | 'solicitudes'; courseId?: string }) {
  const revision = useDemoRevision();
  const [localActor, setLocalActor] = useState(DEMO_USER_ID);
  const currentActor = actor ?? localActor;
  const setActor = onActorChange ?? setLocalActor;
  const [query, setQuery] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('course-physics-2');
  const [selectedUser, setSelectedUser] = useState('participant-01');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  if (revision === null) return <p>Cargando datos de demostración…</p>;
  let s;
  try { s = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos de demostración.</p>; }
  const api = new EnrollmentService(browserStore);
  const groups = s.sections.filter(x => x.courseId === selectedCourse);
  const selectedSection = groups.length === 1 ? groups[0].id : '';
  const effectiveActor = role === 'administrador' ? DEMO_USER_ID : currentActor;
  const requests = (s.requests ?? []).filter(r => (!courseId || r.courseId === courseId) && (role === 'administrador' || (role === 'participante' ? r.participantId === effectiveActor : s.assignments.some(a => a.userId === effectiveActor && a.sectionId === r.sectionId))));
  const memberSections = s.sections.filter(sec => (!courseId || sec.courseId === courseId) && s.assignments.some(a => a.sectionId === sec.id && a.userId === effectiveActor));
  async function run(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setMessage('');
    try { const result = await action(); setMessage(result.ok ? 'Operación de demostración completada.' : result.error ?? 'No se pudo completar.'); }
    catch { setMessage('No se pudo guardar en este navegador.'); } finally { setBusy(false); }
  }
  const name = (id: string) => s.users.find(u => u.id === id)?.displayName ?? 'Usuario ficticio';
  const sectionName = (id: string) => { const sec = s.sections.find(x => x.id === id); return `${s.courses.find(c => c.id === sec?.courseId)?.name ?? 'Curso'}`; };
  return <section><h2>{role === 'administrador' ? 'Gestión de inscripciones' : role === 'participante' ? 'Catálogo y solicitudes' : 'Solicitudes e inscritos'}</h2><p>Datos ficticios guardados solo en este navegador. Los permisos son de demostración.</p>
    {role !== 'administrador' && !courseId && <div className="field"><label htmlFor={`actor-${role}`}>Usuario ficticio</label><select id={`actor-${role}`} value={currentActor} onChange={e => setActor(e.target.value)}>{s.users.filter(u => role === 'participante' ? u.demoParticipant : u.demoFacilitator).map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></div>}
    <p role="status" aria-live="polite">{message}</p>
    {role === 'participante' && <><h3>Catálogo de cursos</h3>{s.sections.filter(sec => s.sections.filter(group => group.courseId === sec.courseId).length === 1).map(sec => { const c = s.courses.find(x => x.id === sec.courseId); const f = s.assignments.find(a => a.sectionId === sec.id); const active = s.enrollments.some(e => e.userId === currentActor && e.sectionId === sec.id && e.status !== 'retirada'); const pending = requests.some(r => r.sectionId === sec.id && r.status === 'pendiente'); const available = sec.status === 'active' && c?.status === 'active' && !!f; return <article className="course" key={sec.id}><strong>{c?.name}</strong><p>{c?.code} · {f ? name(f.userId) : 'Sin facilitador'}</p><p>{active ? 'Inscrito' : pending ? 'Solicitud pendiente' : available ? 'Disponible' : 'No disponible'}</p><button type="button" disabled={busy || !available || active || pending} onClick={() => { if (confirm('¿Enviar solicitud de inscripción de demostración?')) run(() => api.request(currentActor, sec.id)); }}>Solicitar inscripción</button></article>; })}</>}
    {role === 'administrador' && mode !== 'solicitudes' && <><h3>Inscripción directa</h3><div className="field"><label htmlFor="member-search">Buscar participante</label><input id="member-search" value={query} onChange={e => { setQuery(e.target.value); setSelectedUser(''); }} /></div><div className="field"><label htmlFor="member">Participante</label><select id="member" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}><option value="">Selecciona un participante</option>{s.users.filter(u => u.demoParticipant && `${u.displayName} ${u.id}`.toLowerCase().includes(query.toLowerCase())).map(u => <option key={u.id} value={u.id}>{u.displayName} · {u.id}</option>)}</select></div><div className="field"><label htmlFor="section-select">Curso</label><select id="section-select" value={selectedCourse} onChange={e => setSelectedCourse(e.target.value)}>{s.courses.map(x => <option key={x.id} value={x.id}>{x.name}</option>)}</select>{groups.length !== 1 && <p>Este curso tiene grupos históricos que requieren revisión.</p>}</div><button disabled={busy || !selectedUser || !selectedSection} onClick={() => { if (confirm('¿Inscribir a este participante ficticio?')) run(() => api.direct(effectiveActor, selectedUser, selectedSection)); }}>Inscribir</button><h3>Inscripciones</h3>{s.enrollments.filter(e => e.sectionId === selectedSection).map((e, i) => <p key={`${e.userId}-${i}`}>{name(e.userId)} · {e.status === 'retirada' ? 'Retirada' : 'Activa'} {e.status !== 'retirada' && <button disabled={busy} onClick={() => { if (confirm('¿Retirar esta inscripción de demostración?')) run(() => api.withdraw(effectiveActor, e.userId, e.sectionId)); }}>Retirar</button>}</p>)}</>}
    {role === 'facilitador' && <><h3>Participantes inscritos</h3>{memberSections.length ? memberSections.map(sec => <article className="course" key={sec.id}><strong>{sectionName(sec.id)}</strong>{s.enrollments.filter(e => e.sectionId === sec.id && e.status !== 'retirada').map(e => <p key={e.userId}>{name(e.userId)}</p>)}</article>) : <p>No hay cursos asignados.</p>}</>}
    {mode !== 'inscripciones' && <><h3>{role === 'participante' ? 'Mis solicitudes' : 'Solicitudes recibidas'}</h3>{requests.length === 0 && <p>No hay solicitudes.</p>}{requests.map(r => <article className="course" key={r.id}><strong>{sectionName(r.sectionId)}</strong><p>{name(r.participantId)} · {r.status} · {r.origin} · {new Date(r.createdAt).toLocaleDateString('es')}</p>{r.status === 'pendiente' && (role === 'participante' ? <button disabled={busy} onClick={() => { if (confirm('¿Cancelar la solicitud?')) run(() => api.resolve(effectiveActor, r.id, 'cancelada')); }}>Cancelar</button> : <><button disabled={busy} onClick={() => { if (confirm('¿Aprobar la solicitud e inscribir al participante?')) run(() => api.resolve(effectiveActor, r.id, 'aprobada')); }}>Aprobar</button><button disabled={busy} onClick={() => { if (confirm('¿Rechazar la solicitud?')) run(() => api.resolve(effectiveActor, r.id, 'rechazada')); }}>Rechazar</button></>)}</article>)}</>}
  </section>;
}
