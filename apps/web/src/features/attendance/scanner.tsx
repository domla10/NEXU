'use client';
import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { AttendanceService, type AttendanceSession, type AttendanceState } from '@/lib/academic/attendance-service';

export function DemoScanner({ actor }: { actor: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const scanRequest = useRef(0);
  const [scanning, setScanning] = useState(false);
  const [busy, setBusy] = useState(false);
  const [raw, setRaw] = useState('');
  const [found, setFound] = useState<AttendanceSession | null>(null);
  const [message, setMessage] = useState('');
  const revision = useDemoRevision();

  useEffect(() => {
    const requests = scanRequest;
    return () => { requests.current++; controls.current?.stop(); };
  }, []);

  function stop() {
    scanRequest.current++;
    controls.current?.stop();
    controls.current = null;
    setScanning(false);
  }

  async function start() {
    setFound(null);
    if (!navigator.mediaDevices?.getUserMedia) { setMessage('La cámara no está disponible. Usa HTTPS o la alternativa de texto.'); return; }
    const requestId = ++scanRequest.current;
    setScanning(true);
    setMessage('Solicitando acceso a la cámara…');
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (requestId !== scanRequest.current || !video.current) return;
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromVideoDevice(undefined, video.current, result => {
        if (result && requestId === scanRequest.current) {
          setRaw(result.getText());
          setFound(null);
          setMessage('QR detectado. Pulsa comprobar.');
          stop();
        }
      });
      if (requestId !== scanRequest.current) { scanner.stop(); return; }
      controls.current = scanner;
      setMessage('Acerca el QR a la cámara.');
    } catch {
      if (requestId === scanRequest.current) {
        stop();
        setMessage('No se pudo acceder a la cámara. Revisa los permisos o usa la alternativa de texto.');
      }
    }
  }

  function inspect() {
    try {
      const result = new AttendanceService(browserStore).inspect(raw.trim());
      setFound(result.ok ? result.value : null);
      setMessage(result.ok ? 'QR válido en este navegador de demostración.' : result.error);
      if (result.ok) stop();
    } catch { setFound(null); setMessage('No se pudo comprobar el QR en este navegador.'); }
  }

  async function submit(enrolled: boolean) {
    if (!confirm(enrolled ? '¿Registrar asistencia ficticia?' : '¿Solicitar inscripción de demostración?')) return;
    setBusy(true);
    try {
      const service = new AttendanceService(browserStore);
      const result = enrolled ? await service.register(actor, raw.trim()) : await service.requestFromQr(actor, raw.trim());
      setMessage(result.ok ? (enrolled ? 'Asistencia de demostración registrada.' : 'Solicitud de inscripción pendiente. No se registró asistencia.') : result.error);
    } catch { setMessage('No se pudo guardar en este navegador.'); }
    finally { setBusy(false); }
  }

  if (revision === null) return <p>Cargando lector…</p>;
  let state: AttendanceState;
  try { state = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos de demostración.</p>; }
  const enrolled = !!found && state.enrollments.some(e => e.userId === actor && e.sectionId === found.sectionId && e.status !== 'retirada');
  const recorded = found && state.attendance?.some(a => a.sessionId === found.id && a.participantId === actor);
  const pending = found && state.requests?.some(r => r.participantId === actor && r.sectionId === found.sectionId && r.status === 'pendiente');

  return <section className="tool-panel">
    <h2>Escanear QR de demostración</h2>
    <p>Funciona con sesiones guardadas en este navegador. No sincroniza teléfonos.</p>
    <video ref={video} playsInline muted hidden={!scanning} className="scan-video" aria-label="Vista de la cámara"/>
    <button type="button" className="button secondary" onClick={scanning ? () => { stop(); setMessage('Cámara detenida.'); } : start}>
      {scanning ? 'Detener cámara' : 'Abrir cámara'}
    </button>
    <details className="qr-details"><summary>Alternativa de prueba con texto</summary>
      <label htmlFor="scanner-text">Texto de QR de demostración</label>
      <p id="scanner-text-hint">Pega aquí el texto mostrado por el facilitador en este mismo navegador.</p>
      <textarea id="scanner-text" value={raw} aria-label="Texto de QR de demostración" aria-describedby="scanner-text-hint" onChange={e => { setRaw(e.target.value); setFound(null); setMessage(''); }}/>
    </details>
    <button type="button" className="button primary" disabled={!raw.trim() || busy} onClick={inspect}>Comprobar QR</button>
    <p className="feedback" role="status">{message}</p>
    {found && <div className="course">
      <strong>{state.courses.find(c => c.id === found.courseId)?.name}</strong>
      {!enrolled && <p>No estás inscrito en este curso.</p>}
      <button type="button" className="button primary" disabled={busy || (enrolled ? !!recorded : !!pending)} onClick={() => submit(enrolled)}>
        {enrolled ? (recorded ? 'Asistencia registrada' : 'Confirmar asistencia de demostración') : (pending ? 'Solicitud pendiente' : 'Solicitar inscripción')}
      </button>
    </div>}
  </section>;
}
