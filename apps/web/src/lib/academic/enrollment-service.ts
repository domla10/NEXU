import type { EnrollmentRequest, Result, StateStore, DemoState } from './course-management.ts';
import type { Enrollment } from '../../types/academic.ts';

export class EnrollmentService {
  private readonly store: StateStore;
  constructor(store: StateStore) { this.store = store; }
  private admin(s: DemoState, id: string) { return s.users.some(u => u.id === id && u.globalRoles.includes('administrador')); }
  private facilitator(s: DemoState, id: string, sectionId: string) { return s.assignments.some(a => a.userId === id && a.sectionId === sectionId); }
  private available(s: DemoState, sectionId: string) { const section = s.sections.find(x => x.id === sectionId); return section?.status === 'active' && s.courses.some(c => c.id === section.courseId && c.status === 'active'); }
  private active(s: DemoState, userId: string, sectionId: string) { return s.enrollments.some(e => e.userId === userId && e.sectionId === sectionId && e.status !== 'retirada'); }
  private enroll(s: DemoState, userId: string, sectionId: string) { s.enrollments.push({ userId, sectionId, status: 'activa', updatedAt: new Date().toISOString() }); }
  async direct(actor: string, userId: string, sectionId: string): Promise<Result<Enrollment>> {
    const s = this.store.read();
    if (!this.admin(s, actor)) return { ok: false, error: 'Solo administración puede inscribir.' };
    if (!s.users.some(u => u.id === userId && u.demoParticipant)) return { ok: false, error: 'Participante inexistente.' };
    if (!this.available(s, sectionId)) return { ok: false, error: 'La sección no está disponible.' };
    if (this.active(s, userId, sectionId)) return { ok: false, error: 'El participante ya está inscrito.' };
    this.enroll(s, userId, sectionId); this.store.write(s); return { ok: true, value: s.enrollments[s.enrollments.length - 1] };
  }
  async withdraw(actor: string, userId: string, sectionId: string): Promise<Result<Enrollment>> {
    const s = this.store.read(); if (!this.admin(s, actor)) return { ok: false, error: 'Solo administración puede retirar inscripciones.' };
    const e = s.enrollments.find(x => x.userId === userId && x.sectionId === sectionId && x.status !== 'retirada');
    if (!e) return { ok: false, error: 'Inscripción activa no encontrada.' };
    e.status = 'retirada'; e.updatedAt = new Date().toISOString(); this.store.write(s); return { ok: true, value: e };
  }
  async request(actor: string, sectionId: string): Promise<Result<EnrollmentRequest>> {
    const s = this.store.read(); if (!s.users.some(u => u.id === actor && u.demoParticipant)) return { ok: false, error: 'Participante inexistente.' };
    const sec = s.sections.find(x => x.id === sectionId), facilitator = s.assignments.find(a => a.sectionId === sectionId);
    if (!sec || !this.available(s, sectionId) || !facilitator) return { ok: false, error: 'La sección no está disponible.' };
    if (this.active(s, actor, sectionId)) return { ok: false, error: 'Ya estás inscrito.' };
    if ((s.requests ?? []).some(r => r.participantId === actor && r.sectionId === sectionId && r.status === 'pendiente')) return { ok: false, error: 'Ya existe una solicitud pendiente.' };
    const req: EnrollmentRequest = { id: crypto.randomUUID(), participantId: actor, courseId: sec.courseId, sectionId, facilitatorId: facilitator.userId, createdAt: new Date().toISOString(), status: 'pendiente', origin: 'catalogo' };
    s.requests = [...(s.requests ?? []), req]; this.store.write(s); return { ok: true, value: req };
  }
  async resolve(actor: string, requestId: string, decision: 'aprobada' | 'rechazada' | 'cancelada'): Promise<Result<EnrollmentRequest>> {
    const s = this.store.read(); const req = (s.requests ?? []).find(r => r.id === requestId);
    if (!['aprobada', 'rechazada', 'cancelada'].includes(decision)) return { ok: false, error: 'Decisión no válida.' };
    if (!req || req.status !== 'pendiente') return { ok: false, error: 'La solicitud no está pendiente.' };
    if (decision === 'cancelada' ? actor !== req.participantId : !(this.admin(s, actor) || this.facilitator(s, actor, req.sectionId))) return { ok: false, error: 'No tienes permiso para esta operación.' };
    if (decision === 'aprobada') {
      if (!this.available(s, req.sectionId)) return { ok: false, error: 'La sección ya no está disponible.' };
      if (this.active(s, req.participantId, req.sectionId)) return { ok: false, error: 'El participante ya está inscrito.' };
      this.enroll(s, req.participantId, req.sectionId);
    }
    req.status = decision; req.resolvedAt = new Date().toISOString(); req.resolvedBy = actor;
    this.store.write(s); return { ok: true, value: req };
  }
  async myRequests(actor: string): Promise<EnrollmentRequest[]> { return (this.store.read().requests ?? []).filter(r => r.participantId === actor).map(r => ({ ...r })); }
  async sectionRequests(actor: string): Promise<EnrollmentRequest[]> { const s = this.store.read(); return (s.requests ?? []).filter(r => this.admin(s, actor) || this.facilitator(s, actor, r.sectionId)).map(r => ({ ...r })); }
  async members(actor: string, sectionId: string): Promise<Result<Enrollment[]>> {
    const s = this.store.read(); if (!this.admin(s, actor) && !this.facilitator(s, actor, sectionId)) return { ok: false, error: 'No autorizado.' };
    return { ok: true, value: s.enrollments.filter(e => e.sectionId === sectionId).map(e => ({ ...e })) };
  }
}
