import type { Course, Enrollment, FacilitatorAssignment, Section, UserProfile } from '../../types/academic.ts';

export const users: UserProfile[] = [
  { id: 'demo-multiple', displayName: 'Usuario de demostración', globalRoles: ['administrador'], demoFacilitator: true, demoParticipant: true },
  { id: 'participant-extra-01', displayName: 'Participante ficticio adicional 1', globalRoles: [], demoParticipant: true },
  { id: 'participant-extra-02', displayName: 'Participante ficticio adicional 2', globalRoles: [], demoParticipant: true },
  { id: 'facilitator-02', displayName: 'Facilitador de demostración 2', globalRoles: [], demoFacilitator: true },
  ...Array.from({ length: 12 }, (_, i): UserProfile => ({ id: `participant-${String(i + 1).padStart(2, '0')}`, displayName: `Participante ficticio ${i + 1}`, globalRoles: [], demoParticipant: true })),
];
export const modernLanguageCourse: Course = {
  id: 'course-second', slug: 'idioma-moderno', name: 'Idioma Moderno', code: 'DEMO-IDIOMA',
  description: 'Curso ficticio adicional.', program: 'Curso ficticio', institution: 'UNESR',
  campus: 'Núcleo Araure', status: 'active', isPilot: false,
};
export const courses: Course[] = [
  { id: 'course-physics-2', slug: 'fisica-ii', name: 'Física II', code: 'DEMO-FIS2', description: 'Curso ficticio para el piloto.', program: 'Curso piloto provisional', institution: 'UNESR', campus: 'Núcleo Araure', status: 'active', isPilot: true },
  modernLanguageCourse,
];
export const sections: Section[] = [
  { id: 'section-physics-demo', courseId: 'course-physics-2', name: 'Grupo de demostración', code: 'DEMO-A', status: 'active' },
  { id: 'section-second-demo', courseId: 'course-second', name: 'Grupo de demostración', code: 'DEMO-A', status: 'active' },
];
export const assignments: FacilitatorAssignment[] = [
  { sectionId: 'section-physics-demo', userId: 'demo-multiple' },
  { sectionId: 'section-second-demo', userId: 'facilitator-02' },
];
export const enrollments: Enrollment[] = [
  { sectionId: 'section-physics-demo', userId: 'demo-multiple' },
  ...Array.from({ length: 12 }, (_, i) => ({ sectionId: 'section-physics-demo', userId: `participant-${String(i + 1).padStart(2, '0')}` })),
  { sectionId: 'section-second-demo', userId: 'demo-multiple' },
];
