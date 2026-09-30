import React from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@wapcentral/ui';
import { FileQuestion } from 'lucide-react';

export const NotFoundPage: React.FC = () => {
  return (
    <div className="flex min-h-screen w-screen flex-col items-center justify-center p-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400 mb-4">
        <FileQuestion className="h-8 w-8" />
      </div>
      <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
        404 — Page Not Found
      </h1>
      <p className="mt-2 max-w-sm text-sm text-slate-500 dark:text-slate-400">
        The section or resource you requested does not exist on WAPCentral.
      </p>
      <div className="mt-6 flex gap-3">
        <Link to="/">
          <Button variant="primary">Return to Overview</Button>
        </Link>
      </div>
    </div>
  );
};
