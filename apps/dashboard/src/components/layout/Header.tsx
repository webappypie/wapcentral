import React from 'react';
import { useAuth } from '../../contexts/AuthContext.js';
import { useTheme } from '../../contexts/ThemeContext.js';
import { Badge, Button, StatusIndicator } from '@wapcentral/ui';
import { Sun, Moon, LogOut, User as UserIcon } from 'lucide-react';
import type { AdminRole } from '@wapcentral/types';

export const Header: React.FC = () => {
  const { user, signOut, loginAsDemo } = useAuth();
  const { resolvedTheme, toggleTheme } = useTheme();

  const roleColors: Record<
    AdminRole,
    'default' | 'secondary' | 'success' | 'warning' | 'destructive'
  > = {
    super_admin: 'destructive',
    admin: 'warning',
    editor: 'default',
    viewer: 'secondary',
  };

  return (
    <header className="flex h-16 w-full items-center justify-between border-b border-slate-200 bg-white px-6 dark:border-slate-800 dark:bg-slate-900 transition-colors">
      {/* Left: System Status */}
      <div className="flex items-center gap-4">
        <StatusIndicator status="healthy" label="Services Operational" />
      </div>

      {/* Right: Controls & User Profile */}
      <div className="flex items-center gap-3">
        {/* Role Quick Switcher (dev/demo convenience) */}
        <div className="hidden items-center gap-1 sm:flex text-xs text-slate-500 mr-2">
          <span className="text-slate-400">Role:</span>
          {(['viewer', 'editor', 'admin', 'super_admin'] as AdminRole[]).map((r) => (
            <button
              key={r}
              onClick={() => loginAsDemo(r)}
              className={`rounded px-1.5 py-0.5 capitalize transition-colors ${
                user?.role === r
                  ? 'bg-indigo-100 font-bold text-indigo-700 dark:bg-indigo-900/60 dark:text-indigo-300'
                  : 'hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-600 dark:text-slate-400'
              }`}
            >
              {r}
            </button>
          ))}
        </div>

        {/* Theme Toggle */}
        <Button
          variant="ghost"
          size="icon"
          onClick={toggleTheme}
          aria-label="Toggle theme"
          className="text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
        >
          {resolvedTheme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>

        {/* User Card */}
        <div className="flex items-center gap-2.5 pl-2 border-l border-slate-200 dark:border-slate-800">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            <UserIcon className="h-4 w-4" />
          </div>
          <div className="hidden flex-col md:flex">
            <span className="text-xs font-semibold text-slate-900 dark:text-slate-100">
              {user?.displayName || 'Admin User'}
            </span>
            <span className="text-[10px] text-slate-500 dark:text-slate-400">{user?.email}</span>
          </div>
          <Badge
            variant={user?.role ? roleColors[user.role] : 'secondary'}
            className="ml-1 uppercase text-[10px]"
          >
            {user?.role || 'viewer'}
          </Badge>
        </div>

        {/* Sign Out */}
        <Button
          variant="ghost"
          size="icon"
          onClick={signOut}
          aria-label="Sign out"
          title="Sign out"
          className="text-slate-500 hover:text-rose-600 dark:text-slate-400 dark:hover:text-rose-400"
        >
          <LogOut className="h-4 w-4" />
        </Button>
      </div>
    </header>
  );
};
