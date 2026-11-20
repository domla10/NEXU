import { Header } from '@/components/ui';
import { AdminCourses } from '@/features/courses/admin-courses';

export default function AdminPage() {
  return <><Header/><main className="content"><h1>Gestión de cursos</h1><p className="intro">Demostración sin autenticación. Los cambios solo se guardan en este navegador y no son institucionales.</p><AdminCourses/></main></>;
}
