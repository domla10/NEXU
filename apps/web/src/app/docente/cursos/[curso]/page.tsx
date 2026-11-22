import { CoursePage } from '@/components/course-navigation';
export const metadata = { title: 'Curso · Facilitador' };

export default async function Page({ params }: { params: Promise<{ curso: string }> }) {
  const { curso } = await params;
  return <CoursePage slug={curso}/>;
}
