/** Contratos de dominio. Los permisos reales deberán verificarse en el servidor. */
export type AcademicRole = 'participante' | 'facilitador';
export type GlobalRole = 'administrador';
export type CourseStatus = 'active' | 'inactive';
export type UserProfile = { id: string; displayName: string; globalRoles: GlobalRole[] };
export type Course = { id: string; slug: string; name: string; program: string; institution: string; campus: string; status: CourseStatus; isPilot: boolean };
export type Section = { id: string; courseId: string; name: string; status: CourseStatus };
export type FacilitatorAssignment = { sectionId: string; userId: string };
export type Enrollment = { sectionId: string; userId: string };
export type GlobalPermission = 'manage_platform';
export type CoursePermission = 'view_course' | 'manage_course';
export type OperationResult<T> = { ok: true; value: T } | { ok: false; error: 'not_found' | 'forbidden' | 'conflict' };
export type GradeScale = { min: number; max: number; label: string };
export type Evaluation = { title: string; grade: number | null; scale: GradeScale };
export const unesrExampleScale: GradeScale = { min: 1, max: 5, label: 'Ejemplo de escala de 1 a 5' };
