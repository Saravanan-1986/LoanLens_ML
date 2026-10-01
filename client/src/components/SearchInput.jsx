import { Search } from 'lucide-react';

/** Pill search field used in the top bar and the report filter bar. */
export default function SearchInput({
  value,
  onChange,
  placeholder = 'Search...',
  className = '',
  ariaLabel = 'Search'
}) {
  return (
    <div className={`search-wrap ${className}`.trim()}>
      <Search size={16} className="icon-left" />
      <input
        className="input input-search"
        type="search"
        value={value}
        placeholder={placeholder}
        aria-label={ariaLabel}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
