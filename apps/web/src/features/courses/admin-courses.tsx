'use client';
import { useState } from 'react';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { CourseManagement, type DemoState } from '@/lib/academic/course-management';
import { DEMO_USER_ID } from '@/lib/academic/repository';

const service = () => new CourseManagement(browserStore);

export function AdminCourses() {
  const revision = useDemoRevision();
  let data: DemoState | null = null;
  let readError = false;
  if (revision !== null) { try { data = browserStore.read(); } catch { readError = true; } }
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [courseId, setCourseId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [previewUser, setPreviewUser] = useState(DEMO_USER_ID);
  const [previewRole, setPreviewRole] = useState<'participante' | 'facilitador'>('participante');
  const [preview, setPreview] = useState<Awaited<ReturnType<CourseManagement['listForRole']>> | null>(null);
  const [course, setCourse] = useState({ name: '', code: '', description: '', status: 'active' as 'active' | 'inactive' });
  const [section, setSection] = useState({ courseId: '', name: '', code: '', facilitatorId: '', status: 'active' as 'active' | 'inactive' });
  async function perform(action: () => Promise<{ ok: boolean; error?: string }>) {
    setBusy(true); setMessage('');
    try {
      const result = await action();
      if (!result.ok) { setMessage(result.error ?? 'No se pudo guardar.'); return; }
      setMessage('Cambios de demostración guardados en este navegador.');
    } catch { setMessage('No se pudo acceder al almacenamiento de demostración.'); }
    finally { setBusy(false); }
  }
  if (readError) return <p role="alert">No se pueden leer los datos de demostración.</p>;
  if (!data) return <p>Cargando datos de demostración…</p>;
  return <>
    <p role="status" aria-live="polite">{message}</p>
    <h2>Consultar asignaciones de demostración</h2>
    <div className="field"><label htmlFor="preview-user">Usuario ficticio</label><select id="preview-user" value={previewUser} onChange={e => { setPreviewUser(e.target.value); setPreview(null); }}>{data.users.map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></div>
    <div className="field"><label htmlFor="preview-role">Contexto</label><select id="preview-role" value={previewRole} onChange={e => { setPreviewRole(e.target.value as 'participante' | 'facilitador'); setPreview(null); }}><option value="participante">Participante</option><option value="facilitador">Facilitador</option></select></div>
    <button type="button" onClick={async () => { try { setPreview(await service().listForRole(previewUser, previewRole)); } catch { setMessage('No se pudieron consultar las asignaciones.'); } }}>Consultar cursos y secciones</button>
    {preview && (preview.length ? <ul>{preview.map(item => <li key={item.section.id}>{item.course.name} · {item.section.name} ({item.section.code})</li>)}</ul> : <p>No hay asignaciones para este contexto.</p>)}
    <h2>Todos los cursos</h2>
    {data.courses.map(c => <div key={c.id} className="course"><strong>{c.name}</strong><p>{c.code} · {c.status === 'active' ? 'Activo' : 'Inactivo'}</p><button onClick={() => { setCourseId(c.id); setCourse({ name: c.name, code: c.code, description: c.description, status: c.status }); }}>Editar curso</button></div>)}
    <h2>{courseId ? 'Editar curso' : 'Crear curso'}</h2>
    <form onSubmit={e => { e.preventDefault(); if (courseId && !window.confirm('¿Guardar los cambios de este curso de demostración?')) return; perform(() => service().saveCourse(DEMO_USER_ID, course, courseId || undefined)); }}>
      <div className="field"><label htmlFor="course-name">Nombre</label><input id="course-name" required value={course.name} onChange={e => setCourse({ ...course, name: e.target.value })}/></div>
      <div className="field"><label htmlFor="course-code">Código de demostración</label><input id="course-code" required value={course.code} onChange={e => setCourse({ ...course, code: e.target.value })}/></div>
      <div className="field"><label htmlFor="course-description">Descripción</label><input id="course-description" required value={course.description} onChange={e => setCourse({ ...course, description: e.target.value })}/></div>
      <div className="field"><label htmlFor="course-status">Estado</label><select id="course-status" value={course.status} onChange={e => setCourse({ ...course, status: e.target.value as 'active' | 'inactive' })}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div>
      <button disabled={busy}>{busy ? 'Guardando…' : 'Guardar curso'}</button>{courseId && <button type="button" onClick={() => { setCourseId(''); setCourse({ name: '', code: '', description: '', status: 'active' }); }}>Nuevo curso</button>}
    </form>
    <h2>Secciones</h2>
    {data.sections.map(s => <div key={s.id} className="course"><strong>{s.name}</strong><p>{data.courses.find(c => c.id === s.courseId)?.name} · {s.code} · {s.status === 'active' ? 'Activa' : 'Inactiva'}</p><button onClick={() => { setSectionId(s.id); setSection({ courseId: s.courseId, name: s.name, code: s.code, status: s.status, facilitatorId: data.assignments.find(a => a.sectionId === s.id)?.userId ?? '' }); }}>Editar sección</button></div>)}
    <h2>{sectionId ? 'Editar sección' : 'Crear sección'}</h2>
    <form onSubmit={e => { e.preventDefault(); if (sectionId && !window.confirm('¿Guardar los cambios de esta sección de demostración?')) return; perform(() => service().saveSection(DEMO_USER_ID, section, sectionId || undefined)); }}>
      <div className="field"><label htmlFor="section-course">Curso</label><select id="section-course" required disabled={!!sectionId} value={section.courseId} onChange={e => setSection({ ...section, courseId: e.target.value })}><option value="">Selecciona un curso</option>{data.courses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
      <div className="field"><label htmlFor="section-name">Nombre</label><input id="section-name" required value={section.name} onChange={e => setSection({ ...section, name: e.target.value })}/></div>
      <div className="field"><label htmlFor="section-code">Identificador de demostración</label><input id="section-code" required value={section.code} onChange={e => setSection({ ...section, code: e.target.value })}/></div>
      <div className="field"><label htmlFor="section-facilitator">Facilitador</label><select id="section-facilitator" required value={section.facilitatorId} onChange={e => setSection({ ...section, facilitatorId: e.target.value })}><option value="">Selecciona un facilitador</option>{data.users.filter(u => u.demoFacilitator).map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></div>
      <div className="field"><label htmlFor="section-status">Estado</label><select id="section-status" value={section.status} onChange={e => setSection({ ...section, status: e.target.value as 'active' | 'inactive' })}><option value="active">Activa</option><option value="inactive">Inactiva</option></select></div>
      <button disabled={busy}>{busy ? 'Guardando…' : 'Guardar sección'}</button>{sectionId && <button type="button" onClick={() => { setSectionId(''); setSection({ courseId: '', name: '', code: '', facilitatorId: '', status: 'active' }); }}>Nueva sección</button>}
    </form>
  </>;
}
