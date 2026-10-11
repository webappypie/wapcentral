import { describe, it, expect } from 'vitest';
import { app, auth } from './lib/firebase.js';

describe('Dashboard Firebase Production Configuration', () => {
  it('should initialize Firebase App and Auth instances', () => {
    expect(app).toBeDefined();
    expect(auth).toBeDefined();
  });

  it('should source project configuration targeting production', () => {
    const options = app.options;
    expect(options.projectId).toBe('wapcentral-prod');
    expect(options.authDomain).toBe('wapcentral-prod.firebaseapp.com');
    expect(options.storageBucket).toBe('wapcentral-prod.firebasestorage.app');
  });

  it('should not use any placeholder or demo API key', () => {
    const apiKey = app.options.apiKey;
    expect(apiKey).toBeDefined();
    expect(apiKey).not.toBe('AIzaSyDemoPlaceholderForDevelopment');
    expect(apiKey?.toLowerCase()).not.toContain('placeholder');
    expect(apiKey?.toLowerCase()).not.toContain('demo');
  });
});
