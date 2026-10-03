import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Bell, ChevronDown, HelpCircle, LogOut, Menu, UserRound } from 'lucide-react';

import SearchInput from './SearchInput';
import { useAuth } from '../context/AuthContext';
import { initials } from '../utils/format';

/**
 * Top navigation: global search, notification/help icons and the user menu.
 * The avatar reflects the signed-in account and the menu offers sign out.
 */
export default function Topbar({ onOpenNav }) {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [term, setTerm] = useState('');
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  const userName = user?.name || 'LoanLens User';
  const userRole = user?.role || 'Borrower';

  // Close the account menu on an outside click or Escape.
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) setMenuOpen(false);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  const submitSearch = (event) => {
    event.preventDefault();
    const value = term.trim();
    navigate(value ? `/agreements?search=${encodeURIComponent(value)}` : '/agreements');
  };

  const signOut = () => {
    setMenuOpen(false);
    logout();
    navigate('/login', { replace: true });
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

        <div className="user-menu-wrap" ref={menuRef}>
          <button
            type="button"
            className="user-menu"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((open) => !open)}
          >
            <span className="avatar">{initials(userName)}</span>
            <span className="who">
              <strong>{userName}</strong>
              <span>{userRole}</span>
            </span>
            <ChevronDown size={15} />
          </button>

          {menuOpen ? (
            <div className="user-dropdown" role="menu">
              <div className="user-dropdown-head">
                <span className="avatar">{initials(userName)}</span>
                <div className="grow">
                  <div className="strong truncate">{userName}</div>
                  <div className="text-xs muted truncate">{user?.email || ''}</div>
                </div>
              </div>
              <Link className="user-dropdown-item" to="/settings" role="menuitem" onClick={() => setMenuOpen(false)}>
                <UserRound size={15} />
                Account &amp; settings
              </Link>
              <button type="button" className="user-dropdown-item danger" role="menuitem" onClick={signOut}>
                <LogOut size={15} />
                Sign out
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </header>
  );
}

