'use client';
import { useState } from 'react';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { CourseManagement, type DemoState } from '@/lib/academic/course-management';
import { DEMO_USER_ID } from '@/lib/academic/repository';
import type { Course, CourseStatus } from '@/types/academic';

const emptyForm = () => ({ name: '', code: '', description: '', status: 'active' as CourseStatus, facilitatorId: DEMO_USER_ID });

export function AdminCourses() {
  const revision = useDemoRevision();
  const [mode, setMode] = useState<'list' | 'create' | 'edit'>('list');
  const [id, setId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState(emptyForm);
  if (revision === null) return <p>Cargando cursos…</p>;
  let state: DemoState;
  try { state = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos de demostración.</p>; }

  function cancel() {
    setMode('list'); setId(''); setForm(emptyForm()); setMessage('');
  }
  function edit(course: Course) {
    const groups = state.sections.filter(section => section.courseId === course.id);
    if (groups.length !== 1) { setMessage('Este curso tiene grupos históricos que requieren revisión.'); return; }
    setId(course.id);
    setForm({ name: course.name, code: course.code, description: course.description, status: course.status, facilitatorId: state.assignments.find(a => a.sectionId === groups[0].id)?.userId ?? '' });
    setMessage(''); setMode('edit');
  }
  async function save() {
    if (mode === 'edit' && !confirm('¿Guardar cambios del curso de demostración?')) return;
    setBusy(true); setMessage('');
    try {
      const result = await new CourseManagement(browserStore).saveCourse(DEMO_USER_ID, form, mode === 'edit' ? id : undefined);
      if (!result.ok) { setMessage(result.error); return; }
      setMode('list'); setId(''); setForm(emptyForm()); setMessage('Curso guardado en este navegador.');
    } catch { setMessage('No se pudo guardar el curso.'); } finally { setBusy(false); }
  }
  return <>
    <p role="status" aria-live="polite">{message}</p>
    {mode === 'list' ? <><h2>Cursos</h2><div className="course-list">{state.courses.map(course => <article key={course.id} className="course admin-course"><div><strong>{course.name}</strong><p>{course.code} · {course.status === 'active' ? 'Activo' : 'Inactivo'}</p></div><button type="button" className="edit-course" aria-label={`Editar ${course.name}`} onClick={() => edit(course)}><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L8 18l-4 1 1-4Z"/></svg></button></article>)}<button type="button" className="create-course" onClick={() => { setId(''); setForm(emptyForm()); setMessage(''); setMode('create'); }}><span aria-hidden="true">＋</span> Crear nuevo curso</button></div></> : <><h2>{mode === 'edit' ? 'Editar curso' : 'Crear nuevo curso'}</h2><form onSubmit={e => { e.preventDefault(); void save(); }}><div className="field"><label htmlFor="course-name">Nombre</label><input id="course-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></div><div className="field"><label htmlFor="course-code">Código de demostración</label><input id="course-code" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}/></div><div className="field"><label htmlFor="course-description">Descripción</label><input id="course-description" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></div><div className="field"><label htmlFor="course-facilitator">Facilitador</label><select id="course-facilitator" required value={form.facilitatorId} onChange={e => setForm({ ...form, facilitatorId: e.target.value })}><option value="">Selecciona un facilitador</option>{state.users.filter(u => u.demoFacilitator).map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></div><div className="field"><label htmlFor="course-status">Estado</label><select id="course-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as CourseStatus })}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div><div className="course-form-actions"><button type="submit" className="button primary" disabled={busy}>{busy ? 'Guardando…' : 'Guardar'}</button><button type="button" className="button secondary" disabled={busy} onClick={cancel}>Cancelar</button></div></form></>}
  </>;
}
