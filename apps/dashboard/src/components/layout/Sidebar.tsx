import React from 'react';
import { NavLink } from 'react-router-dom';
import { cn } from '@wapcentral/ui';
import {
  type LucideIcon,
  LayoutDashboard,
  Smartphone,
  Sparkles,
  Megaphone,
  Tag,
  Sliders,
  Server,
  BarChart3,
  FileText,
  Settings,
  Layers,
} from 'lucide-react';

interface NavItem {
  name: string;
  to: string;
  icon: LucideIcon;
  badge?: string;
}

const navItems: NavItem[] = [
  { name: 'Overview', to: '/', icon: LayoutDashboard },
  { name: 'Apps', to: '/apps', icon: Smartphone },
  { name: 'AI Gateway', to: '/ai', icon: Sparkles },
  { name: 'Ad Networks', to: '/ads', icon: Megaphone },
  { name: 'Promotions', to: '/promotions', icon: Tag },
  { name: 'Feature Flags', to: '/config', icon: Sliders },
  { name: 'Infrastructure', to: '/infrastructure', icon: Server },
  { name: 'Analytics', to: '/analytics', icon: BarChart3 },
  { name: 'Audit Logs', to: '/audit-logs', icon: FileText },
  { name: 'Settings', to: '/settings', icon: Settings },
];

export const Sidebar: React.FC = () => {
  return (
    <aside className="flex h-screen w-64 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900 transition-colors">
      {/* Brand Header */}
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-6 dark:border-slate-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white shadow-sm dark:bg-indigo-500">
          <Layers className="h-5 w-5" />
        </div>
        <div className="flex flex-col">
          <span className="text-sm font-bold tracking-tight text-slate-900 dark:text-slate-100">
            WAPCentral
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            WebAppyPie Control Plane
          </span>
        </div>
      </div>

      {/* Nav List */}
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            end={item.to === '/'}
            className={({ isActive }) =>
              cn(
                'group flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300 font-semibold'
                  : 'text-slate-700 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800/60',
              )
            }
          >
            {({ isActive }) => (
              <>
                <item.icon
                  className={cn(
                    'h-4 w-4 transition-colors',
                    isActive
                      ? 'text-indigo-600 dark:text-indigo-400'
                      : 'text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300',
                  )}
                />
                <span className="flex-1 truncate">{item.name}</span>
                {item.badge && (
                  <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-xs font-semibold text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200">
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>

      {/* Footer Info */}
      <div className="border-t border-slate-200 p-4 dark:border-slate-800">
        <div className="rounded-lg bg-slate-50 p-3 text-xs text-slate-500 dark:bg-slate-950/40 dark:text-slate-400">
          <div className="flex items-center justify-between font-medium">
            <span>Environment</span>
            <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
              {import.meta.env.VITE_APP_ENV || 'dev'}
            </span>
          </div>
          <div className="mt-1 flex items-center justify-between">
            <span>Version</span>
            <span>v0.2.0</span>
          </div>
        </div>
      </div>
    </aside>
  );
};
