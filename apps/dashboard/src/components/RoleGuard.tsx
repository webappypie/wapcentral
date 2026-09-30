import React from 'react';
import type { AdminRole } from '@wapcentral/types';
import { useAuth } from '../contexts/AuthContext.js';
import { Button, Card, CardContent } from '@wapcentral/ui';
import { ShieldAlert } from 'lucide-react';
import { Link } from 'react-router-dom';

export interface RoleGuardProps {
  requiredRole: AdminRole;
  children: React.ReactNode;
}

export const RoleGuard: React.FC<RoleGuardProps> = ({ requiredRole, children }) => {
  const { hasRole, user } = useAuth();

  if (!hasRole(requiredRole)) {
    return (
      <div className="flex flex-col items-center justify-center p-8">
        <Card className="max-w-md border-amber-200 bg-amber-50/50 text-center dark:border-amber-950 dark:bg-amber-950/20">
          <CardContent className="pt-6">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-600 dark:bg-amber-900/50 dark:text-amber-400">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h3 className="text-lg font-semibold text-amber-900 dark:text-amber-200">
              Permission Required
            </h3>
            <p className="mt-2 text-sm text-amber-750 dark:text-amber-300">
              This action or section requires <strong className="capitalize">{requiredRole}</strong>{' '}
              role or higher. Your current role is{' '}
              <strong className="capitalize">{user?.role || 'viewer'}</strong>.
            </p>
            <div className="mt-6 flex justify-center gap-3">
              <Link to="/">
                <Button variant="outline" size="sm">
                  Back to Overview
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
};
