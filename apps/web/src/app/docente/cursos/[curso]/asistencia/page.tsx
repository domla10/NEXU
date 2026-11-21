import { AttendancePage } from '@/components/course-navigation';
export default async function Page({ params }: { params: Promise<{ curso: string }> }) {
  const { curso } = await params;
  return <AttendancePage slug={curso} type="start"/>;
}
