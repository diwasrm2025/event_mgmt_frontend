import { registrationClosed } from '@/lib/registration';
export function EventStatusBadge({ event }: { event: { status: string; registrationDeadline?: string | null; registrationClosed?: boolean } }) {
 const closed = event.status !== 'testing' && (registrationClosed(event) || event.status === 'completed' || event.status === 'closed');
 const tone = closed || event.status === 'sold-out' ? 'closed' : event.status === 'published' ? 'published' : event.status === 'testing' ? 'testing' : 'draft';
 const label = closed ? 'Registration closed' : event.status === 'sold-out' ? 'Sold out' : event.status === 'published' ? 'Published' : event.status === 'testing' ? 'Testing' : 'Draft';
 return <span className={'event-status-pill event-status-' + tone}>{label}</span>;
}
