'use client';
import { useEffect, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { AttendanceService, type AttendanceState } from '@/lib/academic/attendance-service';

export function SessionPanel({ courseId, actor }: { courseId: string; actor: string }) {
  const revision = useDemoRevision();
  const [sectionId, setSection] = useState('');
  const [sessionId, setSession] = useState('');
  const [show, setShow] = useState(false);
  const [payload, setPayload] = useState('');
  const [now, setNow] = useState(() => Date.now());
  const [message, setMessage] = useState('');
  const [present, setPresent] = useState(false);
  const service = new AttendanceService(browserStore);
  useEffect(() => { const timer = window.setInterval(() => setNow(Date.now()), 1000); return () => window.clearInterval(timer); }, []);
  useEffect(() => {
    function syncFullscreen() { if (!document.fullscreenElement) setPresent(false); }
    document.addEventListener('fullscreenchange', syncFullscreen);
    return () => document.removeEventListener('fullscreenchange', syncFullscreen);
  }, []);
  useEffect(() => {
    if (!sessionId || !show) return;
    let cancelled = false;
    new AttendanceService(browserStore).issue(actor, sessionId).then(result => { if (!cancelled) { if (result.ok) setPayload(result.value); else setMessage(result.error); } });
    const timer = window.setInterval(() => { new AttendanceService(browserStore).issue(actor, sessionId).then(result => { if (!cancelled && result.ok) setPayload(result.value); }); }, 1000);
    return () => { cancelled = true; clearInterval(timer); };
  }, [actor, sessionId, show]);
  if (revision === null) return <p>Cargando sesión de demostración…</p>;
  let s: AttendanceState; try { s = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos.</p>; }
  const available = s.sections.filter(x => x.courseId === courseId && x.status === 'active' && (s.assignments.some(a => a.sectionId === x.id && a.userId === actor) || s.users.some(u => u.id === actor && u.globalRoles.includes('administrador'))));
  const active = (s.sessions ?? []).filter(x => x.courseId === courseId && available.some(sec => sec.id === x.sectionId));
  const current = active.find(x => x.id === sessionId);
  const section = s.sections.find(x => x.id === current?.sectionId);
  const course = s.courses.find(x => x.id === courseId);
  const members = s.enrollments.filter(e => e.sectionId === current?.sectionId && e.status !== 'retirada');
  const records = (s.attendance ?? []).filter(a => a.sessionId === current?.id);
  async function create() { const result = await service.create(actor, sectionId); if (result.ok) { setSession(result.value.id); setMessage('Sesión preparada.'); } else setMessage(result.error); }
  async function transition(next: 'activa' | 'finalizada') { if (next === 'finalizada' && !confirm('¿Finalizar la sesión de demostración?')) return; const r = await service.transition(actor, sessionId, next); if (r.ok) { setMessage(next === 'activa' ? 'Sesión iniciada.' : 'Sesión finalizada.'); if (next === 'finalizada') { setShow(false); setPresent(false); if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); } } else setMessage(r.error); }
  async function enter() { setPresent(true); try { await document.documentElement.requestFullscreen(); } catch { /* La presentación visual sigue disponible. */ } }
  async function leave() { setPresent(false); if (document.fullscreenElement) await document.exitFullscreen().catch(() => {}); }
  return <section><p>Demostración local en este navegador. El QR no valida asistencia real entre dispositivos.</p><p role="status">{message}</p><div className="field"><label htmlFor="attendance-section">Sección</label><select id="attendance-section" value={sectionId} onChange={e => setSection(e.target.value)}><option value="">Selecciona una sección</option>{available.map(x => <option key={x.id} value={x.id}>{x.name} · {x.code}</option>)}</select></div><button disabled={!sectionId} onClick={create}>Crear sesión</button>
    <div className="field"><label htmlFor="attendance-session">Sesión</label><select id="attendance-session" value={sessionId} onChange={e => { setSession(e.target.value); setShow(false); }}><option value="">Selecciona una sesión</option>{active.map(x => <option key={x.id} value={x.id}>{s.sections.find(z => z.id === x.sectionId)?.name} · {x.status} · {new Date(x.createdAt).toLocaleString('es')}</option>)}</select></div>
    {current && <><p>Estado: {current.status}</p>{current.status === 'preparada' && <button onClick={() => transition('activa')}>Iniciar sesión de asistencia</button>}{current.status === 'activa' && <><button onClick={() => setShow(!show)}>{show ? 'Ocultar QR' : 'Mostrar QR'}</button>{show && payload && <><button onClick={enter}>Presentar QR</button><div className={present ? 'qr-presentation' : 'qr-inline'}><h2>{course?.name}</h2><p>{section?.name} · Sesión activa</p><QRCodeSVG value={payload} size={260} marginSize={4} level="M"/><p>Renovación en {Math.max(0, Math.ceil(((current.expiresAt ?? 0) - now) / 1000))} s</p><p>QR de demostración · renovación automática</p>{present && <button onClick={leave}>Salir de presentación</button>}<button onClick={() => transition('finalizada')}>Finalizar sesión</button></div><details><summary>Texto del QR para prueba en este navegador</summary><p>No permite sincronizar teléfonos.</p><textarea readOnly value={payload} aria-label="Texto de QR de demostración"/></details></>}</>}{current.status !== 'finalizada' && !show && <button onClick={() => transition('finalizada')}>Finalizar sesión</button>}<h2>Asistencia de esta sesión</h2><p>{records.length} de {members.length} participantes</p>{members.map(e => { const record = records.find(r => r.participantId === e.userId); return <p key={e.userId}>{s.users.find(u => u.id === e.userId)?.displayName} · {record ? `Registrada ${new Date(record.recordedAt).toLocaleTimeString('es')} · QR de demostración` : 'Sin registro'}</p>; })}</>}
  </section>;
}
