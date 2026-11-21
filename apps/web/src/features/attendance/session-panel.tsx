'use client';
import { useEffect, useRef, useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { AttendanceService, type AttendanceState } from '@/lib/academic/attendance-service';

function SessionQr({ courseName, payload, expiresAt, busy, finish }: {
  courseName: string;
  payload: string;
  expiresAt: number;
  busy: boolean;
  finish: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const presentButton = useRef<HTMLButtonElement>(null);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    const element = dialog.current;
    function fullscreenChanged() {
      if (!document.fullscreenElement && element?.open) element.close();
    }
    document.addEventListener('fullscreenchange', fullscreenChanged);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('fullscreenchange', fullscreenChanged);
      if (element?.open && document.fullscreenElement) void document.exitFullscreen().catch(() => {});
    };
  }, []);

  async function enter() {
    const element = dialog.current;
    if (!element || element.open) return;
    try { await document.documentElement.requestFullscreen?.(); } catch { /* El diálogo funciona sin pantalla completa. */ }
    if (element.isConnected && !element.open) element.showModal();
    else if (!element.isConnected && document.fullscreenElement) await document.exitFullscreen().catch(() => {});
  }

  function leave() {
    dialog.current?.close();
  }

  const qr = <>
    <p>Sesión activa</p>
    <QRCodeSVG value={payload} size={260} marginSize={4} level="M" role="img" title="Código QR de asistencia de demostración"/>
    <p>Renovación en {Math.max(0, Math.ceil((expiresAt - now) / 1000))} s</p>
    <p className="section-description">QR de demostración · renovación automática</p>
  </>;

  return <>
    <button className="button primary" type="button" ref={presentButton} aria-haspopup="dialog" onClick={enter}>Presentar QR</button>
    <div className="qr-inline"><h2>{courseName}</h2>{qr}
      <button className="button danger" type="button" disabled={busy} onClick={finish}>Finalizar sesión</button>
    </div>
    <dialog className="qr-presentation" ref={dialog} aria-labelledby="qr-dialog-title" onClose={() => {
      if (document.fullscreenElement) void document.exitFullscreen().catch(() => {});
      presentButton.current?.focus();
    }}>
      <h2 id="qr-dialog-title">{courseName}</h2>{qr}
      <div className="control-row">
        <button type="button" className="button secondary" onClick={leave}>Salir de presentación</button>
        <button type="button" className="button danger" disabled={busy} onClick={finish}>Finalizar sesión</button>
      </div>
    </dialog>
    <details className="qr-details"><summary>Texto del QR para prueba en este navegador</summary>
      <p>No permite sincronizar teléfonos.</p>
      <textarea readOnly value={payload} aria-label="Texto de QR de demostración"/>
    </details>
  </>;
}

export function SessionPanel({ courseId, actor }: { courseId: string; actor: string }) {
  const revision = useDemoRevision();
  const [sessionId, setSession] = useState('');
  const [shownSessionId, setShownSessionId] = useState('');
  const [payload, setPayload] = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const sessionSelect = useRef<HTMLSelectElement>(null);

  let state: AttendanceState | undefined;
  try { if (revision !== null) state = browserStore.read(); } catch { /* Se informa abajo. */ }
  const available = state?.sections.filter(section => section.courseId === courseId && section.status === 'active' && (state.assignments.some(a => a.sectionId === section.id && a.userId === actor) || state.users.some(u => u.id === actor && u.globalRoles.includes('administrador')))) ?? [];
  const sessions = (state?.sessions ?? []).filter(session => session.courseId === courseId && available.some(section => section.id === session.sectionId));
  const openSession = sessions.find(session => session.status !== 'finalizada');
  const current = sessions.find(session => session.id === sessionId) ?? openSession;
  const show = !!current && shownSessionId === current.id;
  const qrSession = show && current.status === 'activa' ? current.id : '';

  useEffect(() => {
    if (!qrSession) return;
    let cancelled = false;
    const service = new AttendanceService(browserStore);
    async function renew() {
      try {
        const result = await service.issue(actor, qrSession);
        if (cancelled) return;
        if (result.ok) setPayload(result.value);
        else { setPayload(''); setMessage(result.error); }
      } catch { if (!cancelled) { setPayload(''); setMessage('No se pudo renovar el QR en este navegador.'); } }
    }
    void renew();
    const timer = window.setInterval(renew, 1000);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [actor, qrSession]);

  if (revision === null) return <p>Cargando sesión de demostración…</p>;
  if (!state) return <p role="alert">No se pueden leer los datos.</p>;
  const course = state.courses.find(x => x.id === courseId);
  const members = state.enrollments.filter(e => e.sectionId === current?.sectionId && e.status !== 'retirada');
  const records = (state.attendance ?? []).filter(a => a.sessionId === current?.id);

  async function changeSession(action: 'crear' | 'activa' | 'finalizada') {
    if (action === 'finalizada' && !confirm('¿Finalizar la sesión de demostración? Se cerrará el registro con este QR.')) return;
    setBusy(true);
    try {
      const service = new AttendanceService(browserStore);
      const result = action === 'crear' ? await service.create(actor, available[0].id) : await service.transition(actor, current?.id ?? '', action);
      if (!result.ok) { setMessage(result.error); return; }
      setSession(result.value.id);
      setMessage(action === 'crear' ? 'Sesión preparada.' : action === 'activa' ? 'Sesión iniciada.' : 'Sesión finalizada.');
      if (action === 'finalizada') { setShownSessionId(''); setPayload(''); }
      sessionSelect.current?.focus();
    } catch { setMessage('No se pudo guardar la sesión en este navegador.'); }
    finally { setBusy(false); }
  }

  return <section className="tool-panel">
    <p>Demostración local en este navegador. El QR no valida asistencia real entre dispositivos.</p>
    <p role="status" className="feedback">{message}</p>
    {available.length === 1
      ? <button type="button" className="button primary" disabled={busy || !!openSession} onClick={() => changeSession('crear')}>Crear sesión</button>
      : <p>No se puede iniciar la asistencia: revisa los grupos asociados al curso.</p>}
    <div className="field">
      <label htmlFor="attendance-session">Sesión</label>
      <select ref={sessionSelect} id="attendance-session" value={current?.id ?? ''} onChange={e => { setSession(e.target.value); setShownSessionId(''); setPayload(''); setMessage(''); }}>
        {!sessions.length && <option value="">Sin sesiones disponibles</option>}
        {sessions.length > 0 && !openSession && <option value="">Selecciona una sesión</option>}
        {sessions.map(session => <option key={session.id} value={session.id}>{course?.name} · {session.status} · {new Date(session.createdAt).toLocaleString('es')}</option>)}
      </select>
    </div>
    {current && <>
      <p>Estado: <strong>{current.status}</strong></p>
      <div className="control-row">
        {current.status === 'preparada' && <button className="button primary" type="button" disabled={busy} onClick={() => changeSession('activa')}>Iniciar sesión de asistencia</button>}
        {current.status === 'activa' && <button className="button secondary" type="button" aria-expanded={show} aria-controls="qr-content" onClick={() => { setPayload(''); setShownSessionId(show ? '' : current.id); }}>{show ? 'Ocultar QR' : 'Mostrar QR'}</button>}
        {current.status !== 'finalizada' && !qrSession && <button className="button danger" type="button" disabled={busy} onClick={() => changeSession('finalizada')}>Finalizar sesión</button>}
      </div>
      {current.status === 'activa' && <div id="qr-content" hidden={!show}>
        {qrSession && (payload
          ? <SessionQr courseName={course?.name ?? 'Curso'} payload={payload} expiresAt={current.expiresAt ?? 0} busy={busy} finish={() => changeSession('finalizada')}/>
          : <p>Preparando QR…</p>)}
      </div>}
      <h2>Asistencia de esta sesión</h2>
      <p>{records.length} de {members.length} participantes</p>
      {members.map(member => {
        const record = records.find(r => r.participantId === member.userId);
        return <p key={member.userId}>{state.users.find(u => u.id === member.userId)?.displayName} · {record ? `Registrada ${new Date(record.recordedAt).toLocaleTimeString('es')} · QR de demostración` : 'Sin registro'}</p>;
      })}
    </>}
  </section>;
}
