import type { AcademicRole, Course, CoursePermission, GlobalPermission } from '../../types/academic.ts';
import { assignments, courses, enrollments, sections, users } from './demo-data.ts';

export interface AcademicRepository {
  listCoursesForUser(userId: string, role: AcademicRole): Promise<Course[]>;
  findCourseBySlug(slug: string): Promise<Course | undefined>;
  hasGlobalPermission(userId: string, permission: GlobalPermission): Promise<boolean>;
  hasCoursePermission(userId: string, courseId: string, permission: CoursePermission): Promise<boolean>;
}
export const DEMO_USER_ID = 'demo-multiple';
const hasMembership = (userId: string, courseId: string, role: AcademicRole) => {
  const sectionIds = sections.filter(s => s.courseId === courseId && s.status === 'active').map(s => s.id);
  const rows = role === 'facilitador' ? assignments : enrollments;
  return rows.some(row => row.userId === userId && sectionIds.includes(row.sectionId));
};
export const demoRepository: AcademicRepository = {
  async listCoursesForUser(userId, role) {
    return courses.filter(c => c.status === 'active' && hasMembership(userId, c.id, role)).map(c => ({ ...c }));
  },
  async findCourseBySlug(slug) {
    const course = courses.find(c => c.slug === slug && c.status === 'active');
    return course ? { ...course } : undefined;
  },
  async hasGlobalPermission(userId, permission) {
    return permission === 'manage_platform' && users.some(u => u.id === userId && u.globalRoles.includes('administrador'));
  },
  async hasCoursePermission(userId, courseId, permission) {
    if (!users.some(u => u.id === userId) || !courses.some(c => c.id === courseId && c.status === 'active')) return false;
    return hasMembership(userId, courseId, 'facilitador') || (permission === 'view_course' && hasMembership(userId, courseId, 'participante'));
  },
};
