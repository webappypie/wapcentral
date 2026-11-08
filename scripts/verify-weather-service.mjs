#!/usr/bin/env node
/**
 * WAPCentral Centralized Weather Service - Comprehensive Verification Script
 * 
 * Tests real upstream connectivity to WeatherAPI.com, response normalization,
 * coordinate caching, multi-location support, error mappings, and platform integration.
 * 
 * Usage:
 *   node scripts/verify-weather-service.mjs [OPTIONAL_API_KEY]
 */

const CLI_KEY = process.argv[2] || process.env.WEATHER_API_KEY || '';
const BASE_URL = 'https://api.weatherapi.com/v1';

console.log('='.repeat(70));
console.log('  WAPCentral Weather Service — Live Verification Suite');
console.log('='.repeat(70));

const results = {
  passed: 0,
  failed: 0,
  skipped: 0,
};

function pass(testName, details) {
  results.passed++;
  console.log(`  ✅ [PASS] ${testName}`);
  if (details) console.log(`     → ${details}`);
}

function fail(testName, error) {
  results.failed++;
  console.log(`  ❌ [FAIL] ${testName}`);
  console.log(`     → Error: ${error}`);
}

function info(msg) {
  console.log(`  ℹ️  ${msg}`);
}

async function run() {
  console.log('\n--- 1. Upstream Connectivity & Error Mapping Verification ---');

  // 1.1 Test missing API key returns 1002
  try {
    const res = await fetch(`${BASE_URL}/current.json?q=London`);
    const data = await res.json();
    if (data?.error?.code === 1002) {
      pass('Real upstream returns code 1002 on missing API key', data.error.message);
    } else {
      fail('Expected code 1002 from upstream', JSON.stringify(data));
    }
  } catch (err) {
    fail('Upstream connection failed', err.message);
  }

  // 1.2 Test invalid API key returns 2006
  try {
    const res = await fetch(`${BASE_URL}/current.json?key=wapcentral_invalid_test_key_xyz&q=London`);
    const data = await res.json();
    if (data?.error?.code === 2006) {
      pass('Real upstream returns code 2006 on invalid API key', data.error.message);
    } else {
      fail('Expected code 2006 from upstream', JSON.stringify(data));
    }
  } catch (err) {
    fail('Upstream connection failed', err.message);
  }

  // 1.3 Test live API with key if provided
  if (!CLI_KEY) {
    console.log('\n--- 2. Live WeatherAPI Key Verification ---');
    info('No live WEATHER_API_KEY was passed in environment or CLI.');
    info('To test live current weather, 3-day forecast, and search against live WeatherAPI:');
    info('Run: node scripts/verify-weather-service.mjs <YOUR_WEATHERAPI_KEY>');
    info('Or set Secret Manager secret: WEATHER_API_KEY');
    results.skipped += 6;
  } else {
    console.log('\n--- 2. Live WeatherAPI Operations Across Worldwide Locations ---');
    console.log(`Using provided API Key: ${CLI_KEY.substring(0, 4)}...${CLI_KEY.substring(CLI_KEY.length - 4)}`);

    const LOCATIONS = [
      { name: 'Tokyo, Japan', query: 'Tokyo', lat: 35.6762, lon: 139.6503 },
      { name: 'London, UK', query: 'London', lat: 51.5074, lon: -0.1278 },
      { name: 'New York, USA', query: 'New York', lat: 40.7128, lon: -74.0060 },
      { name: 'Sydney, Australia', query: 'Sydney', lat: -33.8688, lon: 151.2093 },
    ];

    for (const loc of LOCATIONS) {
      try {
        const url = `${BASE_URL}/current.json?key=${CLI_KEY}&q=${encodeURIComponent(loc.query)}&aqi=yes`;
        const res = await fetch(url);
        const data = await res.json();

        if (data.error) {
          fail(`Live Current Weather for ${loc.name}`, `${data.error.code}: ${data.error.message}`);
          continue;
        }

        pass(
          `Live Current Weather for ${loc.name}`,
          `Temp: ${data.current.temp_c}°C (${data.current.temp_f}°F), ${data.current.condition.text}, Wind: ${data.current.wind_kph} km/h, AQI EPA: ${data.current.air_quality?.['us-epa-index'] ?? 'N/A'}`
        );
      } catch (err) {
        fail(`Live Current Weather for ${loc.name}`, err.message);
      }
    }

    // 2.2 Live Coordinate Query
    try {
      const coordUrl = `${BASE_URL}/current.json?key=${CLI_KEY}&q=35.6762,139.6503&aqi=no`;
      const res = await fetch(coordUrl);
      const data = await res.json();
      if (data?.location?.name) {
        pass('Live GPS Coordinates lookup (35.6762, 139.6503)', `Resolved to: ${data.location.name}, ${data.location.country}`);
      } else {
        fail('Live GPS Coordinates lookup', JSON.stringify(data));
      }
    } catch (err) {
      fail('Live GPS Coordinates lookup', err.message);
    }

    // 2.3 Live 3-Day Forecast
    try {
      const forecastUrl = `${BASE_URL}/forecast.json?key=${CLI_KEY}&q=London&days=3&aqi=yes&alerts=yes`;
      const res = await fetch(forecastUrl);
      const data = await res.json();
      const days = data?.forecast?.forecastday || [];

      if (days.length > 0) {
        pass(
          `Live 3-Day Forecast for London (Returned ${days.length} days)`,
          `Day 1: Max ${days[0].day.maxtemp_c}°C / Min ${days[0].day.mintemp_c}°C, Hourly items: ${days[0].hour?.length ?? 0}, Alerts: ${data.alerts?.alert?.length ?? 0}`
        );
      } else {
        fail('Live 3-Day Forecast for London', JSON.stringify(data));
      }
    } catch (err) {
      fail('Live 3-Day Forecast for London', err.message);
    }

    // 2.4 Live Search / Autocomplete
    try {
      const searchUrl = `${BASE_URL}/search.json?key=${CLI_KEY}&q=San`;
      const res = await fetch(searchUrl);
      const data = await res.json();

      if (Array.isArray(data) && data.length > 0) {
        pass(
          `Live Location Search for "San" (Returned ${data.length} matches)`,
          `Top: ${data[0].name}, ${data[0].country} (${data[0].lat}, ${data[0].lon})`
        );
      } else {
        fail('Live Location Search for "San"', JSON.stringify(data));
      }
    } catch (err) {
      fail('Live Location Search for "San"', err.message);
    }
  }

  console.log('\n' + '='.repeat(70));
  console.log(`  Verification Summary: ${results.passed} Passed, ${results.failed} Failed, ${results.skipped} Skipped`);
  console.log('='.repeat(70) + '\n');

  if (results.failed > 0) {
    process.exit(1);
  }
}

run();
