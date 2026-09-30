import { describe, it, expect } from 'vitest';
import React from 'react';
import { renderToString } from 'react-dom/server';
import { DevicePreview } from './DevicePreview.js';

describe('DevicePreview Component', () => {
  it('should render banner layout with title, description, and CTA', () => {
    const html = renderToString(
      <DevicePreview
        layoutVariant="banner"
        title="Super Deal on Pro Calc"
        description="Calculate faster with scientific modes"
        ctaText="Get It Now"
        storeUrl="https://play.google.com/store"
      />,
    );

    expect(html).toContain('Super Deal on Pro Calc');
    expect(html).toContain('Calculate faster with scientific modes');
    expect(html).toContain('Get It Now');
    expect(html).toContain('Live Mock Preview:');
    expect(html).toContain('BANNER');
    expect(html).toContain('AD');
  });

  it('should render fullscreen interstitial layout with close button and promotion notice', () => {
    const html = renderToString(
      <DevicePreview
        layoutVariant="interstitial"
        title="WAP Notes AI Takeover"
        description="Instant speech-to-text transcripts"
        ctaText="Install Free"
        storeUrl="https://play.google.com/store"
      />,
    );

    expect(html).toContain('WAP Notes AI Takeover');
    expect(html).toContain('Instant speech-to-text transcripts');
    expect(html).toContain('Install Free');
    expect(html).toContain('Live Mock Preview:');
    expect(html).toContain('INTERSTITIAL');
    expect(html).toContain('Sponsored Promotion');
    expect(html).toContain('Provided by WebAppyPie Promotion Network');
  });

  it('should render native in-feed card layout with Promoted badge', () => {
    const html = renderToString(
      <DevicePreview
        layoutVariant="native"
        title="Sponsored Native In-Feed Story"
        description="Seamlessly embedded within content flow"
        ctaText="Read More"
        storeUrl="https://webappypie.com"
      />,
    );

    expect(html).toContain('Sponsored Native In-Feed Story');
    expect(html).toContain('Seamlessly embedded within content flow');
    expect(html).toContain('Read More');
    expect(html).toContain('Promoted');
    expect(html).toContain('Live Mock Preview:');
    expect(html).toContain('NATIVE');
  });
});
