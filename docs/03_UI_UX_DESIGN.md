# UI/UX Design

## Character
Premium, clean, technical and trustworthy. Avoid a generic Firebase-admin look.

## Navigation
Overview
Apps
AI
Ads
Promotions
Config
Infrastructure
Analytics
Audit Logs
Settings

## Overview
Cards: Active Apps, AI Requests Today, Estimated AI Cost, Active Promotions, Provider Health, Critical Alerts.
Charts: AI usage, cost by provider/app, promotion impressions/clicks, errors/latency.

## Apps
Table: icon, name, platform, version, environment, status, last activity.
Details tabs: Overview, Configuration, AI, Ads, Promotion, Analytics, Health.

## AI
Provider cards show status, enabled state, models, usage, estimated cost, limits and last health check.
Actions: enable/disable, policy, fallback, connection test, usage.
Never show full secrets.

## Promotions
Campaign table with status, promoted app, target apps, dates, impressions, clicks, CTR and priority.
Editor: basics, targets, creative, copy, CTA, schedule, frequency, targeting, preview, publish.
Include live banner preview.

## Creative Manager
Drag/drop upload, preview, dimensions, size, MIME, optimization status and usage.

## Config
Grouped controls for feature flags, maintenance, promotion, AI, cache/timeout and minimum app version.
Dangerous changes require confirmation.

## Visual system
Neutral background, strong typography, restrained accent, semantic status colors, 8px spacing system, medium radius, subtle borders/shadows, restrained animation.

## States
Every screen must define loading, empty, error, permission denied, offline/stale, success and destructive confirmation.

## Responsive
Desktop-first; tablet usable; mobile supports monitoring/simple controls.
