/** Friendly empty state used whenever a list or page has no data. */
export default function EmptyState({ icon: Icon, title, text, actions, tone = '' }) {
  return (
    <div className="state-block">
      {Icon ? (
        <div className={`state-icon ${tone}`.trim()}>
          <Icon size={26} strokeWidth={2} />
        </div>
      ) : null}
      <h2 className="state-title">{title}</h2>
      {text ? <p className="state-text">{text}</p> : null}
      {actions ? <div className="state-actions">{actions}</div> : null}
    </div>
  );
}
