import { Compass } from 'lucide-react';
import { Link } from 'react-router-dom';

import EmptyState from '../components/EmptyState';

/** 404 route. */
export default function NotFound() {
  return (
    <div className="fade-in">
      <div className="card">
        <div className="card-body">
          <EmptyState
            icon={Compass}
            title="Page not found"
            text="The page you are looking for does not exist or has been moved."
            actions={
              <Link className="btn btn-primary" to="/dashboard">
                Back to dashboard
              </Link>
            }
          />
        </div>
      </div>
    </div>
  );
}
