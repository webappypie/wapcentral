import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { RoleGuard } from './components/RoleGuard.js';
import { AuthProvider } from './contexts/AuthContext.js';

describe('Dashboard Role and Auth Guards', () => {
  it('should render permission denied state when role is insufficient', () => {
    // Demo user with viewer role (level 1) attempting to access admin (level 3)
    const html = renderToString(
      <MemoryRouter>
        <AuthProvider>
          <RoleGuard requiredRole="admin">
            <div data-testid="secret-content">Admin Protected Area</div>
          </RoleGuard>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(html).toContain('Permission Required');
    expect(html).toContain('requires');
    expect(html).toContain('admin');
    expect(html).not.toContain('Admin Protected Area');
  });

  it('should render permission prompt with Back to Overview action button', () => {
    const html = renderToString(
      <MemoryRouter>
        <AuthProvider>
          <RoleGuard requiredRole="super_admin">
            <div>Super Admin Area</div>
          </RoleGuard>
        </AuthProvider>
      </MemoryRouter>,
    );

    expect(html).toContain('Back to Overview');
  });
});
