/** Page title block: eyebrow, heading, subtitle and right-hand actions. */
export default function PageHeader({ eyebrow, title, subtitle, actions, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow ? <div className="eyebrow">{eyebrow}</div> : null}
        {title ? <h1>{title}</h1> : null}
        {subtitle ? <p className="subtitle">{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className="page-head-actions">{actions}</div> : null}
    </div>
  );
}
