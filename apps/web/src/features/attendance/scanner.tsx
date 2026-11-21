'use client';
import { useEffect, useRef, useState } from 'react';
import type { IScannerControls } from '@zxing/browser';
import { browserStore, useDemoRevision } from '@/lib/academic/browser-store';
import { AttendanceService, type AttendanceSession } from '@/lib/academic/attendance-service';

export function DemoScanner({ actor }: { actor: string }) {
  const video = useRef<HTMLVideoElement>(null);
  const controls = useRef<IScannerControls | null>(null);
  const active = useRef(false);
  const scanRequest = useRef(0);
  const [scanning, setScanning] = useState(false);
  const [raw, setRaw] = useState('');
  const [found, setFound] = useState<AttendanceSession | null>(null);
  const [message, setMessage] = useState('');
  const revision = useDemoRevision();
  useEffect(() => {
    const requests = scanRequest;
    active.current = true;
    return () => { active.current = false; requests.current++; controls.current?.stop(); };
  }, []);
  function stop() { scanRequest.current++; controls.current?.stop(); controls.current = null; setScanning(false); }
  async function start() {
    setMessage(''); setFound(null);
    if (!navigator.mediaDevices?.getUserMedia) { setMessage('La cámara no está disponible. Usa HTTPS o la alternativa de texto.'); return; }
    const requestId = ++scanRequest.current;
    setScanning(true);
    try {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      if (!video.current) throw new Error('Cámara no disponible');
      const reader = new BrowserQRCodeReader();
      const scanner = await reader.decodeFromVideoDevice(undefined, video.current, result => { if (result && active.current) { setRaw(result.getText()); setMessage('QR detectado. Pulsa comprobar.'); } });
      if (!active.current || requestId !== scanRequest.current) { scanner.stop(); return; }
      controls.current = scanner;
    } catch { if (active.current && requestId === scanRequest.current) { setScanning(false); setMessage('No se pudo acceder a la cámara. Revisa los permisos o usa la alternativa de texto.'); } }
  }
  function inspect() { const r = new AttendanceService(browserStore).inspect(raw); if (!r.ok) { setFound(null); setMessage(r.error); } else { setFound(r.value); setMessage('QR válido en este navegador de demostración.'); stop(); } }
  async function register() { if (!confirm('¿Registrar asistencia ficticia?')) return; const r = await new AttendanceService(browserStore).register(actor, raw); setMessage(r.ok ? 'Asistencia de demostración registrada.' : r.error); }
  async function request() { if (!confirm('¿Solicitar inscripción de demostración?')) return; const r = await new AttendanceService(browserStore).requestFromQr(actor, raw); setMessage(r.ok ? 'Solicitud de inscripción pendiente. No se registró asistencia.' : r.error); }
  if (revision === null) return <p>Cargando lector…</p>;
  let state; try { state = browserStore.read(); } catch { return <p role="alert">No se pueden leer los datos de demostración.</p>; }
  const enrolled = found && state.enrollments.some(e => e.userId === actor && e.sectionId === found.sectionId && e.status !== 'retirada');
  return <section><h2>Escanear QR de demostración</h2><p>Funciona con sesiones guardadas en este navegador. No sincroniza teléfonos.</p><video ref={video} playsInline muted style={{ width: scanning ? '100%' : 0, maxWidth: 360 }} aria-label="Vista de la cámara"/>{scanning ? <button onClick={stop}>Detener cámara</button> : <button onClick={start}>Abrir cámara</button>}<details><summary>Alternativa de prueba con texto</summary><p>Pega aquí el texto mostrado por el facilitador en este mismo navegador.</p><textarea value={raw} onChange={e => { setRaw(e.target.value); setFound(null); }} aria-label="Texto de QR de demostración"/></details><button disabled={!raw} onClick={inspect}>Comprobar QR</button><p role="status">{message}</p>{found && <><p>{state.courses.find(c => c.id === found.courseId)?.name} · {state.sections.find(s => s.id === found.sectionId)?.name}</p>{enrolled ? <button onClick={register}>Confirmar asistencia de demostración</button> : <><p>No estás inscrito en esta sección.</p><button onClick={request}>Solicitar inscripción</button></>}</>}</section>;
}
