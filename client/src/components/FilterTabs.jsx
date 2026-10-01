/**
 * Chip style filter group.
 * @param {{options: Array<{key: string, label: string, count?: number}>, value: string, onChange: Function}} props
 */
export default function FilterTabs({ options = [], value, onChange, className = '' }) {
  return (
    <div className={`filter-chips ${className}`.trim()} role="tablist">
      {options.map((option) => {
        const active = option.key === value;
        return (
          <button
            key={option.key}
            type="button"
            role="tab"
            aria-selected={active}
            className={`chip ${active ? 'active' : ''}`.trim()}
            onClick={() => onChange(option.key)}
          >
            {option.label}
            {Number.isFinite(option.count) ? (
              <span className="chip-count">{option.count}</span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
