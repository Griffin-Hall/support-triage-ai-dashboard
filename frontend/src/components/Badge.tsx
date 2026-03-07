import { Priority, Status, Tag, type PriorityType, type StatusType, type TagType } from '../types';

interface BadgeProps {
  type: 'tag' | 'priority' | 'status';
  value: TagType | PriorityType | StatusType | string;
}

const tagStyles: Record<TagType, string> = {
  [Tag.BILLING]: 'bg-amber-100 text-amber-800 border-amber-200',
  [Tag.TECHNICAL]: 'bg-sky-100 text-sky-800 border-sky-200',
  [Tag.SALES]: 'bg-violet-100 text-violet-800 border-violet-200',
  [Tag.MISC]: 'bg-slate-100 text-slate-700 border-slate-200',
};

const priorityStyles: Record<PriorityType, string> = {
  [Priority.LOW]: 'bg-slate-100 text-slate-700 border-slate-200',
  [Priority.MEDIUM]: 'bg-amber-100 text-amber-800 border-amber-200',
  [Priority.HIGH]: 'bg-rose-100 text-rose-800 border-rose-200',
  [Priority.URGENT]: 'bg-rose-200 text-rose-900 border-rose-300',
};

const statusStyles: Record<StatusType, string> = {
  [Status.OPEN]: 'bg-sky-100 text-sky-800 border-sky-200',
  [Status.CLOSED]: 'bg-emerald-100 text-emerald-800 border-emerald-200',
};

function formatLabel(value: string): string {
  return value.toLowerCase().replace(/_/g, ' ').replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function Badge({ type, value }: BadgeProps) {
  const valueKey = value as TagType & PriorityType & StatusType;

  const styles = {
    tag: tagStyles[valueKey as TagType] ?? 'bg-slate-100 text-slate-700 border-slate-200',
    priority: priorityStyles[valueKey as PriorityType] ?? 'bg-slate-100 text-slate-700 border-slate-200',
    status: statusStyles[valueKey as StatusType] ?? 'bg-slate-100 text-slate-700 border-slate-200',
  };

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.08em] ${styles[type]}`}>
      <span className="h-1.5 w-1.5 rounded-full bg-current opacity-75" />
      {formatLabel(String(value))}
    </span>
  );
}
