import { AttendancePage } from '@/components/course-navigation';
export const metadata = { title: 'Iniciar asistencia' };

export default async function Page({ params }: { params: Promise<{ curso: string }> }) {
  const { curso } = await params;
  return <AttendancePage slug={curso} type="start"/>;
}
