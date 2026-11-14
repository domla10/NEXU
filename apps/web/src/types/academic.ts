/** Los roles y las escalas reales deberán proceder de una fuente autorizada. */
export type AcademicRole = 'participante' | 'facilitador';
export type UserProfile = { displayName: string; roles: AcademicRole[] };
export type GradeScale = { min: number; max: number; label: string };
export type Evaluation = { title: string; grade: number | null; scale: GradeScale };
/** Ejemplo configurable, no establece una regla institucional definitiva. */
export const unesrExampleScale: GradeScale = { min: 1, max: 5, label: 'Ejemplo de escala de 1 a 5' };
