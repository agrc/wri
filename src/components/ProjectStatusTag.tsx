import { tv } from 'tailwind-variants';
import { Status } from './ProjectStatus';

const tagStyles = tv({
  base: 'flex max-w-fit cursor-default items-center gap-1 rounded-md border px-3 py-0.5 text-xs text-white',
  variants: {
    status: {
      draft: 'border-gray-200 bg-zinc-500',
      proposed: 'border-gray-200 bg-zinc-800',
      current: 'border-gray-200 bg-sky-600',
      'pending completed': 'border-gray-200 bg-yellow-500',
      completed: 'border-gray-200 bg-green-700',
      cancelled: 'border-gray-200 bg-red-700',
    },
  },
});

export const ProjectStatusTag = ({ status }: { status: string | null }) => {
  if (!status) {
    return null;
  }

  return <div className={tagStyles({ status: status.toLowerCase() as Status })}>{status}</div>;
};
