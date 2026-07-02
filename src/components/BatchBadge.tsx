interface Props {
  batches: string[];
}

export const BatchBadge = ({ batches }: Props) => {
  if (batches.length === 0) return null;

  return (
    <span
      className="inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-medium leading-none"
      style={{ backgroundColor: 'rgba(20,20,19,0.06)', color: 'rgb(108,107,104)' }}
    >
      {batches.join(', ')}
    </span>
  );
};
