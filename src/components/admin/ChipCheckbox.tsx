export function ChipCheckbox({
  name,
  value,
  label,
  defaultChecked,
}: {
  name: string;
  value?: string;
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="relative cursor-pointer">
      <input type="checkbox" name={name} value={value} defaultChecked={defaultChecked} className="peer sr-only" />
      <span className="inline-flex items-center rounded-full border border-black/15 px-3.5 py-1.5 text-sm text-brand-ink transition-colors hover:border-black/30 peer-checked:border-brand-pink peer-checked:bg-brand-pink peer-checked:text-white peer-checked:hover:border-brand-pink">
        {label}
      </span>
    </label>
  );
}
