import { ParticipantsPage } from '@/components/course-navigation';
export const metadata = { title: 'Participantes' };

export default async function Page({ params }: { params: Promise<{ curso: string }> }) {
  const { curso } = await params;
  return <ParticipantsPage slug={curso}/>;
}
