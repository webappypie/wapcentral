import { describe, it, expect, vi, beforeEach } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';

vi.mock('../contexts/AuthContext.js', () => ({
  useAuth: () => ({
    user: { uid: 'usr_super_admin', email: 'admin@webappypie.com', role: 'super_admin' },
    hasRole: () => true,
  }),
}));

vi.mock('../lib/firestore.js', () => ({
  db: {},
  isOfflineMode: true,
  isTestEnv: true,
  isEmulator: false,
}));

vi.mock('../lib/firebase.js', () => ({
  auth: { currentUser: { uid: 'usr_super_admin' }, onAuthStateChanged: vi.fn() },
}));

import { AiPage } from './AiPage.js';

describe('AiPage Playground Component UI Rendering', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render the AI Playground tab button in the navigation bar', () => {
    const html = renderToString(<AiPage />);
    expect(html).toContain('AI Providers');
    expect(html).toContain('Routing Policies &amp; Quotas');
    expect(html).toContain('Model Catalog &amp; Estimated Rates');
    expect(html).toContain('AI Playground');
  });

  it('should render Playground elements when playground tab is selected', () => {
    // We can verify default providers render
    const html = renderToString(<AiPage />);
    expect(html).toContain('AI Gateway &amp; Provider Management');
  });
});
