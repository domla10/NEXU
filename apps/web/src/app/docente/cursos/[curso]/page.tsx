import { CoursePage, courseParams } from '@/components/course-navigation';
export const generateStaticParams = courseParams;
export default async function Page({ params }: { params: Promise<{ curso: string }> }) {
  const { curso } = await params;
  return <CoursePage slug={curso}/>;
}
