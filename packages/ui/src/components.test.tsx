import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import {
  cn,
  Button,
  Badge,
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
  CardFooter,
  Spinner,
  StatusIndicator,
  EmptyState,
  ErrorState,
  PageHeader,
  Table,
  TableHeader,
  TableRow,
  TableHead,
  TableBody,
  TableCell,
} from './index.js';

describe('@wapcentral/ui Components', () => {
  describe('cn utility', () => {
    it('should concatenate class names and filter out falsy values', () => {
      expect(cn('class1', false && 'class2', 'class3')).toBe('class1 class3');
      expect(cn('btn', { 'btn-active': true, 'btn-disabled': false })).toBe('btn btn-active');
    });
  });

  describe('Button component', () => {
    it('should render primary button with children', () => {
      const html = renderToString(<Button variant="primary">Click Me</Button>);
      expect(html).toContain('Click Me');
      expect(html).toContain('bg-indigo-600');
    });

    it('should render loading spinner when isLoading is true', () => {
      const html = renderToString(<Button isLoading>Save</Button>);
      expect(html).toContain('animate-spin');
      expect(html).toContain('disabled=""');
    });

    it('should render destructive variant correctly', () => {
      const html = renderToString(<Button variant="destructive">Delete</Button>);
      expect(html).toContain('bg-rose-600');
    });
  });

  describe('Badge component', () => {
    it('should render badge with appropriate variant class', () => {
      const html = renderToString(<Badge variant="success">Active</Badge>);
      expect(html).toContain('Active');
      expect(html).toContain('bg-emerald-100');
    });
  });

  describe('Card component', () => {
    it('should render complete card hierarchy', () => {
      const html = renderToString(
        <Card>
          <CardHeader>
            <CardTitle>Overview</CardTitle>
            <CardDescription>Daily stats</CardDescription>
          </CardHeader>
          <CardContent>Content here</CardContent>
          <CardFooter>Footer</CardFooter>
        </Card>,
      );
      expect(html).toContain('Overview');
      expect(html).toContain('Daily stats');
      expect(html).toContain('Content here');
      expect(html).toContain('Footer');
    });
  });

  describe('StatusIndicator component', () => {
    it('should render healthy status indicator', () => {
      const html = renderToString(<StatusIndicator status="healthy" label="Online" />);
      expect(html).toContain('Online');
      expect(html).toContain('bg-emerald-500');
    });

    it('should render degraded and unhealthy status indicator', () => {
      const htmlDegraded = renderToString(<StatusIndicator status="degraded" label="Degraded" />);
      expect(htmlDegraded).toContain('bg-amber-500');

      const htmlUnhealthy = renderToString(<StatusIndicator status="unhealthy" label="Offline" />);
      expect(htmlUnhealthy).toContain('bg-rose-500');
    });
  });

  describe('Spinner component', () => {
    it('should render accessible spinner with role status', () => {
      const html = renderToString(<Spinner size="md" />);
      expect(html).toContain('role="status"');
      expect(html).toContain('aria-label="Loading"');
      expect(html).toContain('animate-spin');
    });
  });

  describe('EmptyState component', () => {
    it('should render empty state with title and description', () => {
      const html = renderToString(
        <EmptyState
          title="No apps registered"
          description="Register your first app to get started."
          actionLabel="Add App"
          onAction={() => {}}
        />,
      );
      expect(html).toContain('No apps registered');
      expect(html).toContain('Register your first app to get started.');
      expect(html).toContain('Add App');
    });
  });

  describe('ErrorState component', () => {
    it('should render error state with alert role and message', () => {
      const html = renderToString(
        <ErrorState
          title="Failed to load apps"
          message="Could not connect to database"
          retryLabel="Retry"
          onRetry={() => {}}
        />,
      );
      expect(html).toContain('role="alert"');
      expect(html).toContain('Failed to load apps');
      expect(html).toContain('Could not connect to database');
      expect(html).toContain('Retry');
    });
  });

  describe('PageHeader component', () => {
    it('should render page header with title and actions', () => {
      const html = renderToString(
        <PageHeader
          title="Apps Registry"
          description="Manage all WebAppyPie mobile applications"
          actions={<Button size="sm">New App</Button>}
        />,
      );
      expect(html).toContain('Apps Registry');
      expect(html).toContain('Manage all WebAppyPie mobile applications');
      expect(html).toContain('New App');
    });
  });

  describe('Table component', () => {
    it('should render complete table markup', () => {
      const html = renderToString(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>App Name</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>App One</TableCell>
              <TableCell>Active</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      );
      expect(html).toContain('App Name');
      expect(html).toContain('App One');
      expect(html).toContain('Active');
    });
  });
});
