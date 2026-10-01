import { NavLink } from 'react-router-dom';
import {
  FileSearch,
  Files,
  History,
  LayoutDashboard,
  ScanEye,
  Settings,
  ShieldAlert
} from 'lucide-react';

import { APP_NAME, APP_TAGLINE, NAV_ITEMS, SECONDARY_NAV } from '../utils/constants';
import { initials } from '../utils/format';

const ICONS = {
  LayoutDashboard,
  FileSearch,
  Files,
  ShieldAlert,
  History,
  Settings
};

function NavItem({ item, count, onNavigate }) {
  const Icon = ICONS[item.icon] || LayoutDashboard;

  return (
    <NavLink
      to={item.to}
      className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`.trim()}
      onClick={onNavigate}
    >
      <Icon size={18} strokeWidth={2} />
      <span>{item.label}</span>
      {Number.isFinite(count) && count > 0 ? <span className="nav-count">{count}</span> : null}
    </NavLink>
  );
}

/** Left navigation. `counts` is optional API-driven badge data. */
export default function Sidebar({
  counts = {},
  onNavigate,
  user = { name: 'LoanLens User', role: 'Borrower' }
}) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-mark">
          <ScanEye size={21} strokeWidth={2.2} />
        </div>
        <div className="brand-text">
          <span className="brand-name">{APP_NAME}</span>
          <span className="brand-tag">{APP_TAGLINE}</span>
        </div>
      </div>

      <nav className="nav-group" aria-label="Main">
        <div className="nav-label">Workspace</div>
        {NAV_ITEMS.map((item) => (
          <NavItem
            key={item.to}
            item={item}
            count={
              item.to === '/agreements'
                ? counts.agreements
                : item.to === '/reports'
                  ? counts.risky
                  : undefined
            }
            onNavigate={onNavigate}
          />
        ))}
      </nav>

      <div className="sidebar-spacer" />

      <nav className="nav-group" aria-label="Secondary">
        {SECONDARY_NAV.map((item) => (
          <NavItem key={item.to} item={item} onNavigate={onNavigate} />
        ))}
      </nav>

      <div className="sidebar-note">
        <div className="note-title">
          <ShieldAlert size={14} strokeWidth={2.4} />
          Screening tool
        </div>
        <p>
          LoanLens highlights clauses worth checking. It is not legal advice - always confirm with a
          qualified professional.
        </p>
      </div>

      <div className="sidebar-user">
        <div className="avatar">{initials(user.name)}</div>
        <div className="grow">
          <div className="name truncate">{user.name}</div>
          <div className="role truncate">{user.role}</div>
        </div>
      </div>
    </aside>
  );
}
