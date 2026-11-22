import type { DemoState, StateStore } from './course-management.ts';
export type AttendanceSession = { id: string; courseId: string; sectionId: string; facilitatorId: string; createdAt: string; startedAt?: string; endedAt?: string; status: 'preparada' | 'activa' | 'finalizada'; validitySeconds: number; token?: string; expiresAt?: number };
export type AttendanceRecord = { id: string; sessionId: string; participantId: string; recordedAt: string; method: 'qr-demo'; status: 'registrada' };
export type AttendanceState = DemoState & { sessions?: AttendanceSession[]; attendance?: AttendanceRecord[] };
export type Outcome<T> = { ok: true; value: T } | { ok: false; error: string };
const fail = (error: string) => ({ ok: false as const, error });
export class AttendanceService {
  private store: StateStore;
  constructor(store: StateStore) { this.store = store; }
  private allowed(s: AttendanceState, actor: string, section: string) { return s.users.some(u => u.id === actor && u.globalRoles.includes('administrador')) || s.assignments.some(a => a.userId === actor && a.sectionId === section); }
  async create(actor: string, sectionId: string): Promise<Outcome<AttendanceSession>> {
    const s: AttendanceState = this.store.read(); const sec = s.sections.find(x => x.id === sectionId && x.status === 'active');
    if (!sec || !s.courses.some(c => c.id === sec.courseId && c.status === 'active')) return fail('Sección no disponible.');
    if (!this.allowed(s, actor, sectionId)) return fail('No tienes permiso para gestionar esta sección.');
    if ((s.sessions ?? []).some(x => x.sectionId === sectionId && x.status !== 'finalizada')) return fail('Ya existe una sesión sin finalizar para esta sección.');
    const session: AttendanceSession = { id: crypto.randomUUID(), courseId: sec.courseId, sectionId, facilitatorId: actor, createdAt: new Date().toISOString(), status: 'preparada', validitySeconds: 30 };
    s.sessions = [...(s.sessions ?? []), session]; this.store.write(s); return { ok: true, value: session };
  }
  async transition(actor: string, id: string, next: 'activa' | 'finalizada'): Promise<Outcome<AttendanceSession>> {
    const s: AttendanceState = this.store.read(); const session = (s.sessions ?? []).find(x => x.id === id);
    if (!session || !this.allowed(s, actor, session.sectionId)) return fail('Sesión no disponible o sin autorización.');
    if ((next === 'activa' && session.status !== 'preparada') || (next === 'finalizada' && session.status === 'finalizada')) return fail('Cambio de estado no válido.');
    session.status = next; if (next === 'activa') session.startedAt = new Date().toISOString(); else { session.endedAt = new Date().toISOString(); delete session.token; delete session.expiresAt; }
    this.store.write(s); return { ok: true, value: session };
  }
  async issue(actor: string, id: string, now = Date.now()): Promise<Outcome<string>> {
    const s: AttendanceState = this.store.read(); const session = (s.sessions ?? []).find(x => x.id === id);
    if (!session || session.status !== 'activa' || !this.allowed(s, actor, session.sectionId)) return fail('Sesión no disponible o sin autorización.');
    if (!session.token || !session.expiresAt || now >= session.expiresAt) { session.token = crypto.randomUUID(); session.expiresAt = now + session.validitySeconds * 1000; this.store.write(s); }
    return { ok: true, value: JSON.stringify({ version: 'nexu-demo-qr-1', sessionId: session.id, courseId: session.courseId, sectionId: session.sectionId, token: session.token }) };
  }
  inspect(raw: string, now = Date.now()): Outcome<AttendanceSession> {
    let data: Record<string, unknown>; try { data = JSON.parse(raw); } catch { return fail('QR inválido.'); }
    if (!data || data.version !== 'nexu-demo-qr-1') return fail('QR inválido.');
    const s: AttendanceState = this.store.read(); const session = (s.sessions ?? []).find(x => x.id === data.sessionId);
    if (!session || session.courseId !== data.courseId || session.sectionId !== data.sectionId) return fail('QR inválido.');
    if (session.status !== 'activa') return fail('La sesión no está activa.');
    if (!session.token || session.token !== data.token || !session.expiresAt || now >= session.expiresAt) return fail('El QR ha caducado o fue renovado.');
    return { ok: true, value: { ...session } };
  }
  async register(actor: string, raw: string): Promise<Outcome<AttendanceRecord>> {
    const valid = this.inspect(raw); if (!valid.ok) return valid;
    const s: AttendanceState = this.store.read();
    if (!s.users.some(u => u.id === actor && u.demoParticipant)) return fail('Participante no válido.');
    if (!s.enrollments.some(e => e.userId === actor && e.sectionId === valid.value.sectionId && e.status !== 'retirada')) return fail('No estás inscrito en esta sección.');
    if ((s.attendance ?? []).some(a => a.sessionId === valid.value.id && a.participantId === actor)) return fail('La asistencia ya fue registrada.');
    const entry: AttendanceRecord = { id: crypto.randomUUID(), sessionId: valid.value.id, participantId: actor, recordedAt: new Date().toISOString(), method: 'qr-demo', status: 'registrada' };
    s.attendance = [...(s.attendance ?? []), entry]; this.store.write(s); return { ok: true, value: entry };
  }
  async requestFromQr(actor: string, raw: string): Promise<Outcome<string>> {
    const valid = this.inspect(raw); if (!valid.ok) return valid;
    const s: AttendanceState = this.store.read(); const session = valid.value;
    if (!s.users.some(u => u.id === actor && u.demoParticipant)) return fail('Participante no válido.');
    if (!s.sections.some(x => x.id === session.sectionId && x.status === 'active') || !s.courses.some(x => x.id === session.courseId && x.status === 'active')) return fail('La sección ya no está disponible.');
    if (s.enrollments.some(e => e.userId === actor && e.sectionId === session.sectionId && e.status !== 'retirada')) return fail('Ya estás inscrito.');
    if ((s.requests ?? []).some(r => r.participantId === actor && r.sectionId === session.sectionId && r.status === 'pendiente')) return fail('Ya existe una solicitud pendiente.');
    const facilitator = s.assignments.find(a => a.sectionId === session.sectionId); if (!facilitator) return fail('No hay facilitador asignado.');
    const id = crypto.randomUUID(); s.requests = [...(s.requests ?? []), { id, participantId: actor, sectionId: session.sectionId, courseId: session.courseId, facilitatorId: facilitator.userId, createdAt: new Date().toISOString(), status: 'pendiente', origin: 'qr' }]; this.store.write(s); return { ok: true, value: id };
  }
}
