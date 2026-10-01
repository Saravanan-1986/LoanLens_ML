import { Outlet, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';

import Sidebar from '../components/Sidebar';
import Topbar from '../components/Topbar';
import useDashboardStats from '../hooks/useDashboardStats';

/**
 * Application shell: blue canvas -> rounded white frame -> sidebar + content.
 * The sidebar collapses into a slide-over on tablet and mobile.
 */
export default function AppLayout() {
  const [navOpen, setNavOpen] = useState(false);
  const location = useLocation();
  const { data: stats } = useDashboardStats();

  // Close the mobile drawer whenever the route changes.
  useEffect(() => {
    setNavOpen(false);
  }, [location.pathname]);

  const counts = {
    agreements: stats ? stats.documentsAnalyzed : undefined,
    risky: stats ? stats.riskyClauses : undefined
  };

  return (
    <div className="app-shell">
      <div className={`app-frame ${navOpen ? 'nav-open' : ''}`.trim()}>
        <Sidebar counts={counts} onNavigate={() => setNavOpen(false)} />
        <div
          className={`sidebar-backdrop ${navOpen ? 'show' : ''}`.trim()}
          onClick={() => setNavOpen(false)}
          role="presentation"
        />
        <div className="main-col">
          <Topbar onOpenNav={() => setNavOpen(true)} />
          <main className="content">
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}
