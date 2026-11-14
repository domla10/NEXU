/** Datos provisionales para la demostración; no representan una inscripción real. */
export type DemoCourse = {
  slug: string;
  name: string;
  program: string;
  institution: string;
  campus: string;
};

export const demoCourses: DemoCourse[] = [
  {
    slug: 'quimica-organica',
    name: 'Química Orgánica',
    program: 'Ingeniería de Alimentos',
    institution: 'UNESR',
    campus: 'Núcleo Araure',
  },
];

export function findDemoCourse(slug: string): DemoCourse | undefined {
  return demoCourses.find((course) => course.slug === slug);
}
