import { CoursePage } from '@/components/course-navigation';
export default async function Page({ params }: { params: Promise<{ curso: string }> }) {
  const { curso } = await params;
  return <CoursePage slug={curso}/>;
}
