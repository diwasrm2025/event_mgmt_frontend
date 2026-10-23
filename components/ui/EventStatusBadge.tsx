import { registrationClosed } from '@/lib/registration';
export function EventStatusBadge({ event }: { event: { status: string; registrationDeadline?: string | null; registrationClosed?: boolean } }) {
 const closed = registrationClosed(event) || event.status === 'completed' || event.status === 'closed';
 const tone = closed || event.status === 'sold-out' ? 'closed' : event.status === 'published' ? 'published' : 'draft';
 const label = closed ? 'Registration closed' : event.status === 'sold-out' ? 'Sold out' : event.status === 'published' ? 'Published' : 'Draft';
 return <span className={'event-status-pill event-status-' + tone}>{label}</span>;
}
