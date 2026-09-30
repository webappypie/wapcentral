import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext.js';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, Button } from '@wapcentral/ui';
import { Layers, ShieldCheck, KeyRound } from 'lucide-react';
import type { AdminRole } from '@wapcentral/types';

export const LoginPage: React.FC = () => {
  const { user, signInWithEmail, loginAsDemo } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  // Redirect if already logged in
  const from = (location.state as { from?: { pathname: string } })?.from?.pathname || '/';

  React.useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await signInWithEmail(email, password);
      navigate(from, { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = (role: AdminRole) => {
    loginAsDemo(role);
    navigate(from, { replace: true });
  };

  return (
    <div className="flex min-h-screen w-screen items-center justify-center bg-slate-50 px-4 py-12 dark:bg-slate-950">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md">
            <Layers className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-bold">WAPCentral</CardTitle>
          <CardDescription>WebAppyPie Control Plane Sign In</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {error && (
            <div className="rounded-md bg-rose-50 p-3 text-xs text-rose-700 dark:bg-rose-950/30 dark:text-rose-400">
              {error}
            </div>
          )}

          <form onSubmit={handleEmailLogin} className="space-y-4">
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Email Address
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@webappypie.com"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                Password
              </label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100"
              />
            </div>
            <Button type="submit" className="w-full" isLoading={loading}>
              Sign In
            </Button>
          </form>

          {/* Quick RBAC Demo Login (Development & Local Review) */}
          <div className="border-t border-slate-200 pt-4 dark:border-slate-800">
            <span className="text-xs font-semibold text-slate-500 flex items-center justify-center gap-1.5 mb-2.5">
              <KeyRound className="h-3.5 w-3.5" /> Quick Demo Role Login
            </span>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoLogin('super_admin')}
                className="text-xs text-rose-600 dark:text-rose-400"
              >
                Super Admin (L4)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoLogin('admin')}
                className="text-xs text-amber-600 dark:text-amber-400"
              >
                Admin (L3)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoLogin('editor')}
                className="text-xs text-indigo-600 dark:text-indigo-400"
              >
                Editor (L2)
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleDemoLogin('viewer')}
                className="text-xs text-slate-600 dark:text-slate-400"
              >
                Viewer (L1)
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
