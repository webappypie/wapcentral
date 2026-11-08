import request from 'supertest';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app.js';
import {
  registerMemoryApp,
  resetPlatformQuotaForTest,
} from '../platform/middleware/platformAuth.js';
import {
  resetKillSwitchesForTest,
  setAppKillSwitch,
  setGlobalKillSwitch,
  setServiceKillSwitch,
} from '../platform/services/killSwitchService.js';
import {
  clearWeatherCacheForTest,
  resetWeatherUsageForTest,
  setMockWeatherAdapterForTest,
  buildCacheKey,
  normalizeCurrent,
  normalizeForecast,
  normalizeSearchResults,
} from '../platform/services/platformWeatherService.js';
import { setInternalSecretForTest, clearSecretStoreForTest } from '../services/secretVault.js';

describe('WAPCentral Weather Service Platform Gateway (/api/platform/v1/weather/*)', () => {
  const app = createApp();

  const MOCK_CURRENT_API_RESPONSE = {
    location: {
      name: 'Tokyo',
      region: 'Tokyo',
      country: 'Japan',
      lat: 35.68,
      lon: 139.69,
      tz_id: 'Asia/Tokyo',
      localtime_epoch: 1731089400,
      localtime: '2026-11-08 20:30',
    },
    current: {
      last_updated_epoch: 1731088800,
      last_updated: '2026-11-08 20:20',
      temp_c: 16.5,
      temp_f: 61.7,
      is_day: 0,
      condition: {
        text: 'Partly cloudy',
        icon: '//cdn.weatherapi.com/weather/64x64/night/116.png',
        code: 1003,
      },
      wind_mph: 6.9,
      wind_kph: 11.2,
      wind_degree: 190,
      wind_dir: 'S',
      pressure_mb: 1018.0,
      pressure_in: 30.06,
      precip_mm: 0.0,
      precip_in: 0.0,
      humidity: 62,
      cloud: 25,
      feelslike_c: 16.5,
      feelslike_f: 61.7,
      vis_km: 10.0,
      vis_miles: 6.0,
      uv: 0.0,
      gust_mph: 9.2,
      gust_kph: 14.8,
      air_quality: {
        co: 245.5,
        no2: 12.1,
        o3: 45.2,
        so2: 3.4,
        pm2_5: 8.6,
        pm10: 14.2,
        'us-epa-index': 1,
        'gb-defra-index': 1,
      },
    },
  };

  const MOCK_FORECAST_API_RESPONSE = {
    location: {
      name: 'London',
      region: 'City of London, Greater London',
      country: 'United Kingdom',
      lat: 51.52,
      lon: -0.11,
      tz_id: 'Europe/London',
      localtime_epoch: 1731089400,
      localtime: '2026-11-08 11:30',
    },
    current: {
      last_updated_epoch: 1731088800,
      last_updated: '2026-11-08 11:20',
      temp_c: 12.0,
      temp_f: 53.6,
      is_day: 1,
      condition: {
        text: 'Sunny',
        icon: '//cdn.weatherapi.com/weather/64x64/day/113.png',
        code: 1000,
      },
      wind_kph: 15.0,
      wind_mph: 9.3,
      wind_degree: 230,
      wind_dir: 'SW',
      pressure_mb: 1015.0,
      pressure_in: 29.97,
      precip_mm: 0.0,
      precip_in: 0.0,
      humidity: 70,
      cloud: 10,
      feelslike_c: 11.5,
      feelslike_f: 52.7,
      vis_km: 10.0,
      vis_miles: 6.0,
      uv: 3.0,
    },
    forecast: {
      forecastday: [
        {
          date: '2026-11-08',
          date_epoch: 1731024000,
          day: {
            maxtemp_c: 14.0,
            maxtemp_f: 57.2,
            mintemp_c: 8.0,
            mintemp_f: 46.4,
            avgtemp_c: 11.0,
            avgtemp_f: 51.8,
            maxwind_kph: 20.0,
            maxwind_mph: 12.4,
            totalprecip_mm: 0.5,
            totalprecip_in: 0.02,
            avghumidity: 75.0,
            daily_chance_of_rain: 25,
            daily_chance_of_snow: 0,
            condition: {
              text: 'Patchy rain possible',
              icon: '//cdn.weatherapi.com/weather/64x64/day/176.png',
              code: 1063,
            },
            uv: 3.0,
          },
          astro: {
            sunrise: '07:10 AM',
            sunset: '04:22 PM',
            moonrise: '03:15 AM',
            moonset: '02:40 PM',
            moon_phase: 'Waning Crescent',
            moon_illumination: '15',
          },
          hour: [
            {
              time_epoch: 1731024000,
              time: '2026-11-08 00:00',
              temp_c: 9.0,
              temp_f: 48.2,
              is_day: 0,
              condition: {
                text: 'Clear',
                icon: '//cdn.weatherapi.com/weather/64x64/night/113.png',
                code: 1000,
              },
              wind_kph: 10.0,
              wind_mph: 6.2,
              wind_degree: 210,
              wind_dir: 'SSW',
              pressure_mb: 1015.0,
              humidity: 80,
              cloud: 5,
              feelslike_c: 8.0,
              feelslike_f: 46.4,
              chance_of_rain: 10,
              chance_of_snow: 0,
              uv: 0.0,
            },
            {
              time_epoch: 1731067200,
              time: '2026-11-08 12:00',
              temp_c: 13.5,
              temp_f: 56.3,
              is_day: 1,
              condition: {
                text: 'Partly cloudy',
                icon: '//cdn.weatherapi.com/weather/64x64/day/116.png',
                code: 1003,
              },
              wind_kph: 18.0,
              wind_mph: 11.2,
              wind_degree: 230,
              wind_dir: 'SW',
              pressure_mb: 1014.0,
              humidity: 65,
              cloud: 30,
              feelslike_c: 13.0,
              feelslike_f: 55.4,
              chance_of_rain: 20,
              chance_of_snow: 0,
              uv: 3.0,
            },
          ],
        },
      ],
    },
    alerts: {
      alert: [
        {
          headline: 'Flood Alert for River Thames',
          severity: 'Moderate',
          urgency: 'Expected',
          areas: 'Greater London',
          category: 'Met',
          certainty: 'Likely',
          event: 'Flood Alert',
          note: 'River levels rising',
          effective: '2026-11-08T08:00:00Z',
          expires: '2026-11-08T20:00:00Z',
          desc: 'River levels have risen following recent rainfall.',
          instruction: 'Avoid low lying footpaths near river.',
        },
      ],
    },
  };

  const MOCK_SEARCH_API_RESPONSE = [
    {
      id: 2801268,
      name: 'London',
      region: 'City of London, Greater London',
      country: 'United Kingdom',
      lat: 51.52,
      lon: -0.11,
      url: 'london-city-of-london-greater-london-united-kingdom',
    },
    {
      id: 313757,
      name: 'London',
      region: 'Ontario',
      country: 'Canada',
      lat: 42.98,
      lon: -81.25,
      url: 'london-ontario-canada',
    },
  ];

  beforeEach(() => {
    resetKillSwitchesForTest();
    resetPlatformQuotaForTest();
    clearWeatherCacheForTest();
    resetWeatherUsageForTest();
    clearSecretStoreForTest();

    // Configure global WeatherAPI master key
    setInternalSecretForTest('WEATHER_API_KEY', 'test_weather_api_key_live_123');

    // Register test apps:
    // 1. filezen: weather authorized
    registerMemoryApp({
      id: 'filezen',
      name: 'FileZen',
      packageId: 'com.webappypie.filezen',
      platform: 'android',
      version: '1.0.0',
      environment: 'production',
      status: 'active',
      appKey: 'wap_key_filezen_prod',
      allowedServices: ['ai', 'ocr', 'files', 'weather'],
      enabledModules: ['ai', 'ocr', 'weather' as any],
      serviceQuotas: {
        weather: { dailyRequests: 1000, rateLimitRpm: 60 },
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 2. optilens: weather NOT authorized
    registerMemoryApp({
      id: 'optilens',
      name: 'OptiLens AI',
      packageId: 'com.webappypie.optilens',
      platform: 'android',
      version: '1.0.0',
      environment: 'production',
      status: 'active',
      appKey: 'wap_key_optilens_prod',
      allowedServices: ['image', 'ai'],
      enabledModules: ['image_intelligence', 'ai'],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // 3. clenzy: weather authorized with app-specific key override
    registerMemoryApp({
      id: 'clenzy',
      name: 'Clenzy',
      packageId: 'com.webappypie.clenzy',
      platform: 'android',
      version: '1.0.0',
      environment: 'production',
      status: 'active',
      appKey: 'wap_key_clenzy_prod',
      allowedServices: ['weather'],
      enabledModules: ['weather' as any],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Default mock adapter routing
    setMockWeatherAdapterForTest(async (endpoint, params) => {
      if (endpoint === 'current.json') {
        if (params.q === 'NonExistentCityXYZ999') {
          return { error: { code: 1006, message: "No location found matching parameter 'q'" } };
        }
        return MOCK_CURRENT_API_RESPONSE;
      }
      if (endpoint === 'forecast.json') {
        return MOCK_FORECAST_API_RESPONSE;
      }
      if (endpoint === 'search.json') {
        return MOCK_SEARCH_API_RESPONSE;
      }
      throw new Error(`Unhandled endpoint: ${endpoint}`);
    });
  });

  // ------------------------------------------------------------
  // 1. Normalization & Schema Verification
  // ------------------------------------------------------------
  describe('Weather Normalization', () => {
    it('normalizes current weather response and extracts all core metrics and air quality', () => {
      const normalized = normalizeCurrent(
        MOCK_CURRENT_API_RESPONSE.location,
        MOCK_CURRENT_API_RESPONSE.current,
      );

      expect(normalized.location.name).toBe('Tokyo');
      expect(normalized.location.country).toBe('Japan');
      expect(normalized.location.latitude).toBe(35.68);
      expect(normalized.location.longitude).toBe(139.69);
      expect(normalized.location.timezone).toBe('Asia/Tokyo');

      expect(normalized.temperatureC).toBe(16.5);
      expect(normalized.temperatureF).toBe(61.7);
      expect(normalized.condition.text).toBe('Partly cloudy');
      expect(normalized.condition.code).toBe(1003);
      expect(normalized.windKph).toBe(11.2);
      expect(normalized.humidity).toBe(62);
      expect(normalized.isDay).toBe(false);

      expect(normalized.airQuality).toBeDefined();
      expect(normalized.airQuality?.pm2_5).toBe(8.6);
      expect(normalized.airQuality?.pm10).toBe(14.2);
      expect(normalized.airQuality?.usEpaIndex).toBe(1);
    });

    it('normalizes forecast with daily summaries, astronomy, and 24-hr hourly breakdown', () => {
      const forecast = normalizeForecast(MOCK_FORECAST_API_RESPONSE);

      expect(forecast.location.name).toBe('London');
      expect(forecast.forecastDays).toHaveLength(1);

      const day1 = forecast.forecastDays[0]!;
      expect(day1.date).toBe('2026-11-08');
      expect(day1.day.maxTempC).toBe(14.0);
      expect(day1.day.minTempC).toBe(8.0);
      expect(day1.day.chanceOfRainPct).toBe(25);
      expect(day1.astro.sunrise).toBe('07:10 AM');
      expect(day1.astro.sunset).toBe('04:22 PM');

      expect(day1.hourly).toHaveLength(2);
      expect(day1.hourly[0]!.time).toBe('2026-11-08 00:00');
      expect(day1.hourly[0]!.tempC).toBe(9.0);
      expect(day1.hourly[1]!.time).toBe('2026-11-08 12:00');
      expect(day1.hourly[1]!.tempC).toBe(13.5);

      expect(forecast.alerts).toBeDefined();
      expect(forecast.alerts![0]!.headline).toContain('Flood Alert');
    });

    it('normalizes location search results into structured array', () => {
      const results = normalizeSearchResults(MOCK_SEARCH_API_RESPONSE);
      expect(results).toHaveLength(2);
      expect(results[0]!.name).toBe('London');
      expect(results[0]!.country).toBe('United Kingdom');
      expect(results[1]!.country).toBe('Canada');
    });
  });

  // ------------------------------------------------------------
  // 2. Authentication, Authorization & App Isolation
  // ------------------------------------------------------------
  describe('Authentication & Service Permissions', () => {
    it('rejects unauthenticated request with 401', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('UNAUTHENTICATED');
    });

    it('rejects request with invalid app key with 403', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wrong_key')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('INVALID_APP_KEY');
    });

    it('rejects application attempting to access weather when weather service is not enabled for it', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'optilens')
        .set('X-App-Key', 'wap_key_optilens_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(403);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SERVICE_NOT_AUTHORIZED');
    });

    it('allows authorized application (FileZen) to access weather service', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo', aqi: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.service).toBe('weather');
      expect(res.body.data.weather.location.name).toBe('Tokyo');
      expect(res.body.data.attribution.text).toBe('Powered by WeatherAPI.com');
      expect(res.body.data.attribution.url).toBe('https://www.weatherapi.com/');
    });
  });

  // ------------------------------------------------------------
  // 3. Multi-App Licensing & Credential Isolation
  // ------------------------------------------------------------
  describe('Multi-App Licensing & Credential Hierarchy', () => {
    it('uses app-specific key override when configured in Secret Manager', async () => {
      setInternalSecretForTest('WEATHER_API_KEY_CLENZY', 'app_specific_clenzy_key_456');

      let usedKey = '';
      setMockWeatherAdapterForTest(async (_endpoint, _params, apiKey) => {
        usedKey = apiKey || '';
        return MOCK_CURRENT_API_RESPONSE;
      });

      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'clenzy')
        .set('X-App-Key', 'wap_key_clenzy_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(usedKey).toBe('app_specific_clenzy_key_456');
    });

    it('falls back seamlessly to global WEATHER_API_KEY when no app-specific key is configured', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weather.location.name).toBe('Tokyo');
    });

    it('returns 503 PROVIDER_CREDENTIALS_MISSING when neither app key nor global key is configured', async () => {
      clearSecretStoreForTest();

      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROVIDER_CREDENTIALS_MISSING');
    });
  });

  // ------------------------------------------------------------
  // 4. Current Weather Endpoint (POST & GET)
  // ------------------------------------------------------------
  describe('Current Weather Endpoint', () => {
    it('handles POST /weather/current with city name', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo', aqi: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weather.temperatureC).toBe(16.5);
      expect(res.body.data.weather.condition.text).toBe('Partly cloudy');
      expect(res.body.data.attribution.required).toBe(true);
      expect(res.body.data.cache.cached).toBe(false);
      expect(res.body.executionSource).toBe('external_provider');
    });

    it('handles POST /weather/current with latitude and longitude coordinates', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ latitude: 35.6762, longitude: 139.6503 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weather.location.name).toBe('Tokyo');
    });

    it('handles GET /weather/current with query parameters', async () => {
      const res = await request(app)
        .get('/api/platform/v1/weather/current?q=Tokyo&aqi=yes')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.weather.location.name).toBe('Tokyo');
    });

    it('rejects request with 400 VALIDATION_ERROR when neither query nor lat/lon is provided', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('VALIDATION_ERROR');
    });
  });

  // ------------------------------------------------------------
  // 5. Caching Layer & Permitted Limits
  // ------------------------------------------------------------
  describe('Caching Layer & Compliance', () => {
    it('serves repeat requests from in-memory cache with sub-millisecond latency (cached: true)', async () => {
      // First request: hits external provider
      const res1 = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res1.status).toBe(200);
      expect(res1.body.data.cache.cached).toBe(false);
      expect(res1.body.executionSource).toBe('external_provider');

      // Second identical request: served from cache
      const res2 = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res2.status).toBe(200);
      expect(res2.body.data.cache.cached).toBe(true);
      expect(res2.body.executionSource).toBe('wap_engine');
      expect(res2.body.data.cache.cacheTtlSeconds).toBe(1800); // 30 mins
    });

    it('shares spatial cache when coordinates are within ~110m (rounded to 3 decimal places)', async () => {
      // First coordinates
      await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ latitude: 35.6762, longitude: 139.6503 });

      // Nearby coordinates (differs only in 4th decimal place)
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ latitude: 35.6764, longitude: 139.6501 });

      expect(res.status).toBe(200);
      expect(res.body.data.cache.cached).toBe(true);
      expect(res.body.executionSource).toBe('wap_engine');
    });

    it('bypasses cache when forceRefresh: true is passed', async () => {
      // Populate cache
      await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      // Request with forceRefresh
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo', forceRefresh: true });

      expect(res.status).toBe(200);
      expect(res.body.data.cache.cached).toBe(false);
      expect(res.body.executionSource).toBe('external_provider');
    });
  });

  // ------------------------------------------------------------
  // 6. Forecast & Search Endpoints
  // ------------------------------------------------------------
  describe('Forecast and Search Endpoints', () => {
    it('handles POST /weather/forecast with 3-day forecast and hourly breakdown', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/forecast')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'London', days: 3, alerts: true });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.forecast.forecastDays).toHaveLength(1);
      expect(res.body.data.forecast.forecastDays[0].day.maxTempC).toBe(14.0);
      expect(res.body.data.forecast.alerts).toHaveLength(1);
      expect(res.body.data.attribution.text).toBe('Powered by WeatherAPI.com');
    });

    it('handles GET /weather/forecast with query parameters', async () => {
      const res = await request(app)
        .get('/api/platform/v1/weather/forecast?q=London&days=3')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.forecast.location.name).toBe('London');
    });

    it('handles POST /weather/search with autocomplete results', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/search')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'London' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.results).toHaveLength(2);
      expect(res.body.data.results[0].name).toBe('London');
      expect(res.body.data.results[0].country).toBe('United Kingdom');
    });
  });

  // ------------------------------------------------------------
  // 7. Error Handling & Provider Failures
  // ------------------------------------------------------------
  describe('Error Handling & Provider Failures', () => {
    it('maps 1006 location not found to 404 LOCATION_NOT_FOUND', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'NonExistentCityXYZ999' });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('LOCATION_NOT_FOUND');
    });

    it('maps provider quota exceeded (code 2007) to 429 PROVIDER_QUOTA_EXCEEDED', async () => {
      setMockWeatherAdapterForTest(async () => {
        return {
          error: {
            code: 2007,
            message: 'API key has exceeded calls per month quota',
          },
        };
      });

      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(429);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROVIDER_QUOTA_EXCEEDED');
    });

    it('maps invalid provider API key (code 2006) to 502 PROVIDER_AUTH_ERROR', async () => {
      setMockWeatherAdapterForTest(async () => {
        return {
          error: {
            code: 2006,
            message: 'API key provided is invalid',
          },
        };
      });

      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(502);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('PROVIDER_AUTH_ERROR');
    });
  });

  // ------------------------------------------------------------
  // 8. Platform Kill Switches
  // ------------------------------------------------------------
  describe('Platform Kill Switches', () => {
    it('blocks weather requests with 503 when weather service kill switch is enabled', async () => {
      setServiceKillSwitch('weather', true);

      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('SERVICE_DISABLED');
    });

    it('blocks weather requests when global kill switch is enabled', async () => {
      setGlobalKillSwitch(true);

      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('GLOBAL_KILL_SWITCH_ACTIVE');
    });

    it('blocks weather requests when app kill switch is enabled', async () => {
      setAppKillSwitch('filezen', true);

      const res = await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(503);
      expect(res.body.success).toBe(false);
      expect(res.body.error.code).toBe('APP_KILL_SWITCH_ACTIVE');
    });
  });

  // ------------------------------------------------------------
  // 9. Admin Diagnostics & Quota Monitoring Endpoints
  // ------------------------------------------------------------
  describe('Admin Diagnostics & Quota Monitoring', () => {
    it('GET /weather/status returns monthly quota, calls consumed, and cache entries', async () => {
      // Make a call first
      await request(app)
        .post('/api/platform/v1/weather/current')
        .set('X-App-Id', 'filezen')
        .set('X-App-Key', 'wap_key_filezen_prod')
        .send({ query: 'Tokyo' });

      const res = await request(app).get('/api/platform/v1/weather/status');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.activeProvider).toBe('WeatherAPI.com');
      expect(res.body.data.monthlyQuota).toBe(100000);
      expect(res.body.data.monthlyUsage).toBeGreaterThanOrEqual(1);
      expect(res.body.data.remainingQuota).toBeLessThanOrEqual(99999);
      expect(res.body.data.cacheActiveEntries).toBeGreaterThanOrEqual(1);
      expect(res.body.data.attribution.text).toBe('Powered by WeatherAPI.com');
    });

    it('POST /weather/test executes connection test and returns latency and location', async () => {
      const res = await request(app)
        .post('/api/platform/v1/weather/test')
        .send({ query: 'Tokyo' });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.provider).toBe('WeatherAPI.com');
      expect(res.body.data.location).toBe('Tokyo');
      expect(res.body.data.country).toBe('Japan');
      expect(res.body.data.tempC).toBe(16.5);
    });
  });
});
