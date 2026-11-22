import type { Course, Section, UserProfile, FacilitatorAssignment, Enrollment } from '../../types/academic.ts';

export type CourseData = { name: string; code: string; description: string; status: 'active' | 'inactive' };
export type SectionData = { courseId: string; name: string; code: string; facilitatorId: string; status: 'active' | 'inactive' };
export type DemoState = { courses: Course[]; sections: Section[]; assignments: FacilitatorAssignment[]; enrollments: Enrollment[]; users: UserProfile[] };
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
export interface StateStore { read(): DemoState; write(state: DemoState): void }

export class CourseManagement {
  private readonly store: StateStore;
  constructor(store: StateStore) { this.store = store; }
  private admin(state: DemoState, actor: string) { return state.users.some(u => u.id === actor && u.globalRoles.includes('administrador')); }
  async list(actor: string): Promise<Result<DemoState>> {
    const state = this.store.read();
    if (!this.admin(state, actor)) return { ok: false, error: 'Solo un administrador puede consultar la gestión.' };
    return { ok: true, value: structuredClone(state) };
  }
  async saveCourse(actor: string, data: CourseData, id?: string): Promise<Result<Course>> {
    const state = this.store.read();
    if (!this.admin(state, actor)) return { ok: false, error: 'No tienes permiso para gestionar cursos.' };
    const name = data.name.trim(), code = data.code.trim().toUpperCase(), description = data.description.trim();
    if (!name || !code || !description) return { ok: false, error: 'Completa el nombre, el código y la descripción.' };
    if (!['active', 'inactive'].includes(data.status)) return { ok: false, error: 'Estado de curso inválido.' };
    if (state.courses.some(c => c.id !== id && c.code.toUpperCase() === code)) return { ok: false, error: 'Ya existe un curso con ese código.' };
    const existing = id ? state.courses.find(c => c.id === id) : undefined;
    if (id && !existing) return { ok: false, error: 'Curso no encontrado.' };
    const course: Course = existing ? { ...existing, name, code, description, status: data.status } : { id: crypto.randomUUID(), slug: crypto.randomUUID(), name, code, description, status: data.status, isPilot: false, program: 'Curso de demostración', institution: 'UNESR', campus: 'Núcleo Araure' };
    state.courses = existing ? state.courses.map(c => c.id === id ? course : c) : [...state.courses, course];
    this.store.write(state);
    return { ok: true, value: course };
  }
  async saveSection(actor: string, data: SectionData, id?: string): Promise<Result<Section>> {
    const state = this.store.read();
    if (!this.admin(state, actor)) return { ok: false, error: 'No tienes permiso para gestionar secciones.' };
    const name = data.name.trim(), code = data.code.trim().toUpperCase();
    if (!name || !code) return { ok: false, error: 'Completa el nombre y el identificador de la sección.' };
    if (!['active', 'inactive'].includes(data.status)) return { ok: false, error: 'Estado de sección inválido.' };
    if (!state.courses.some(c => c.id === data.courseId)) return { ok: false, error: 'El curso no existe.' };
    if (!state.users.some(u => u.id === data.facilitatorId && u.demoFacilitator)) return { ok: false, error: 'Selecciona un facilitador de demostración válido.' };
    if (state.sections.some(s => s.id !== id && s.courseId === data.courseId && s.code.toUpperCase() === code)) return { ok: false, error: 'Ese identificador ya existe en el curso.' };
    const old = id ? state.sections.find(s => s.id === id) : undefined;
    if (id && !old) return { ok: false, error: 'Sección no encontrada.' };
    if (old && old.courseId !== data.courseId) return { ok: false, error: 'No se puede trasladar una sección a otro curso.' };
    const section: Section = { id: old?.id ?? crypto.randomUUID(), courseId: data.courseId, name, code, status: data.status };
    state.sections = old ? state.sections.map(s => s.id === id ? section : s) : [...state.sections, section];
    state.assignments = [...state.assignments.filter(a => a.sectionId !== section.id), { sectionId: section.id, userId: data.facilitatorId }];
    this.store.write(state);
    return { ok: true, value: section };
  }
  async listForRole(userId: string, role: 'facilitador' | 'participante'): Promise<{ course: Course; section: Section }[]> {
    const state = this.store.read();
    const links = role === 'facilitador' ? state.assignments : state.enrollments;
    return state.sections.filter(s => s.status === 'active' && links.some(l => l.sectionId === s.id && l.userId === userId)).flatMap(section => {
      const course = state.courses.find(c => c.id === section.courseId && c.status === 'active');
      return course ? [{ course: { ...course }, section: { ...section } }] : [];
    });
  }
}
