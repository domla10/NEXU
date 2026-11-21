'use client';
import { useState } from 'react';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { CourseManagement } from '@/lib/academic/course-management';
import { DEMO_USER_ID } from '@/lib/academic/repository';

export function AdminCourses() {
  const revision = useDemoRevision();
  const [id, setId] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', description: '', status: 'active' as 'active' | 'inactive', facilitatorId: DEMO_USER_ID });
  if (revision === null) return <p>Cargando cursos…</p>;
  let data; try { data = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos de demostración.</p>; }
  const state = data;
  async function save() {
    if (id && !confirm('¿Guardar cambios del curso de demostración?')) return;
    setBusy(true); setMessage('');
    try { const result = await new CourseManagement(browserStore).saveCourse(DEMO_USER_ID, form, id || undefined); setMessage(result.ok ? 'Curso guardado en este navegador.' : result.error); }
    catch { setMessage('No se pudo guardar el curso.'); } finally { setBusy(false); }
  }
  return <><p role="status">{message}</p><h2>Cursos</h2><div className="course-list">{state.courses.map(c => <article key={c.id} className="course"><strong>{c.name}</strong><p>{c.code} · {c.status === 'active' ? 'Activo' : 'Inactivo'}</p><button onClick={() => { const groups = state.sections.filter(s => s.courseId === c.id); if (groups.length !== 1) { setMessage('Este curso tiene grupos históricos que requieren revisión.'); return; } setId(c.id); setForm({ name: c.name, code: c.code, description: c.description, status: c.status, facilitatorId: state.assignments.find(a => a.sectionId === groups[0].id)?.userId ?? '' }); }}>Editar curso</button></article>)}</div><h2>{id ? 'Editar curso' : 'Crear curso'}</h2><form onSubmit={e => { e.preventDefault(); void save(); }}><div className="field"><label htmlFor="course-name">Nombre</label><input id="course-name" required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}/></div><div className="field"><label htmlFor="course-code">Código de demostración</label><input id="course-code" required value={form.code} onChange={e => setForm({ ...form, code: e.target.value })}/></div><div className="field"><label htmlFor="course-description">Descripción</label><input id="course-description" required value={form.description} onChange={e => setForm({ ...form, description: e.target.value })}/></div><div className="field"><label htmlFor="course-facilitator">Facilitador</label><select id="course-facilitator" required value={form.facilitatorId} onChange={e => setForm({ ...form, facilitatorId: e.target.value })}><option value="">Selecciona un facilitador</option>{state.users.filter(u => u.demoFacilitator).map(u => <option key={u.id} value={u.id}>{u.displayName}</option>)}</select></div><div className="field"><label htmlFor="course-status">Estado</label><select id="course-status" value={form.status} onChange={e => setForm({ ...form, status: e.target.value as 'active' | 'inactive' })}><option value="active">Activo</option><option value="inactive">Inactivo</option></select></div><button disabled={busy}>{busy ? 'Guardando…' : 'Guardar curso'}</button>{id && <button type="button" onClick={() => { setId(''); setForm({ name: '', code: '', description: '', status: 'active', facilitatorId: DEMO_USER_ID }); }}>Nuevo curso</button>}</form></>;
}
