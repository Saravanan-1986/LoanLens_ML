import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, HelpCircle, Menu } from 'lucide-react';

import SearchInput from './SearchInput';
import { initials } from '../utils/format';

/**
 * Top navigation: global search, notification/help icons and the user menu.
 */
export default function Topbar({ onOpenNav, userName = 'LoanLens User', userRole = 'Borrower' }) {
  const navigate = useNavigate();
  const [term, setTerm] = useState('');

  const submitSearch = (event) => {
    event.preventDefault();
    const value = term.trim();
    navigate(value ? `/agreements?search=${encodeURIComponent(value)}` : '/agreements');
  };

  return (
    <header className="topbar">
      <button
        type="button"
        className="icon-btn hamburger"
        onClick={onOpenNav}
        aria-label="Open navigation"
      >
        <Menu size={19} />
      </button>

      <form onSubmit={submitSearch} className="search-wrap grow" role="search">
        <SearchInput
          value={term}
          onChange={setTerm}
          placeholder="Search agreements..."
          ariaLabel="Search agreements"
        />
      </form>

      <div className="topbar-actions">
        <Link to="/reports" className="icon-btn" aria-label="Risk reports" title="Risk reports">
          <Bell size={18} />
          <span className="badge-dot" />
        </Link>
        <Link to="/settings" className="icon-btn" aria-label="Help and settings" title="Help">
          <HelpCircle size={18} />
        </Link>
        <div className="divider-v hide-sm" style={{ height: 26 }} />
        <Link to="/settings" className="user-menu">
          <span className="avatar">{initials(userName)}</span>
          <span className="who">
            <strong>{userName}</strong>
            <span>{userRole}</span>
          </span>
          <ChevronDown size={15} />
        </Link>
      </div>
    </header>
  );
}
