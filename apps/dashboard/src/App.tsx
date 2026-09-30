import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { ThemeProvider } from './contexts/ThemeContext.js';
import { AuthProvider } from './contexts/AuthContext.js';
import { AuthGuard } from './components/AuthGuard.js';
import { DashboardLayout } from './components/layout/DashboardLayout.js';

import { OverviewPage } from './pages/OverviewPage.js';
import { AppsPage } from './pages/AppsPage.js';
import { AiPage } from './pages/AiPage.js';
import { AdsPage } from './pages/AdsPage.js';
import { PromotionsPage } from './pages/PromotionsPage.js';
import { ConfigPage } from './pages/ConfigPage.js';
import { InfrastructurePage } from './pages/InfrastructurePage.js';
import { AnalyticsPage } from './pages/AnalyticsPage.js';
import { AuditLogsPage } from './pages/AuditLogsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { LoginPage } from './pages/LoginPage.js';
import { UnauthorizedPage } from './pages/UnauthorizedPage.js';
import { NotFoundPage } from './pages/NotFoundPage.js';

export const App: React.FC = () => {
  return (
    <ThemeProvider>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Routes */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/403" element={<UnauthorizedPage />} />

            {/* Protected Core Dashboard Routes */}
            <Route
              path="/"
              element={
                <AuthGuard>
                  <DashboardLayout />
                </AuthGuard>
              }
            >
              <Route index element={<OverviewPage />} />
              <Route path="apps" element={<AppsPage />} />
              <Route path="ai" element={<AiPage />} />
              <Route path="ads" element={<AdsPage />} />
              <Route path="promotions" element={<PromotionsPage />} />
              <Route path="config" element={<ConfigPage />} />
              <Route path="infrastructure" element={<InfrastructurePage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="audit-logs" element={<AuditLogsPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>

            {/* Catch All 404 */}
            <Route path="*" element={<NotFoundPage />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ThemeProvider>
  );
};

export default App;
