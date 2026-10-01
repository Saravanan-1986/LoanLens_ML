/** Shimmering placeholder block. */
export function SkeletonBlock({ height = 16, width = '100%', radius = 10, className = '', style }) {
  return (
    <div
      className={`skeleton ${className}`.trim()}
      style={{ height, width, borderRadius: radius, ...style }}
      aria-hidden="true"
    />
  );
}

/** A few stacked lines, useful for text placeholders. */
export function SkeletonLines({ lines = 3, gap = 8, height = 12 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap }}>
      {Array.from({ length: lines }).map((_, index) => (
        <SkeletonBlock key={index} height={height} width={index === lines - 1 ? '60%' : '100%'} />
      ))}
    </div>
  );
}

/** Card shaped loading placeholder. */
export function SkeletonCard({ height = 140 }) {
  return <SkeletonBlock height={height} radius={20} />;
}

export default SkeletonBlock;
