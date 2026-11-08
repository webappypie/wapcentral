import { COLLECTIONS, WEATHER_CONFIG } from '@wapcentral/config';
import type {
  App,
  PlatformCurrentWeather,
  PlatformExecutionSource,
  PlatformForecastDay,
  PlatformForecastHour,
  PlatformLocationSearchResult,
  PlatformWeatherAttribution,
  PlatformWeatherCacheMetadata,
  PlatformWeatherCurrentRequest,
  PlatformWeatherCurrentResponse,
  PlatformWeatherForecast,
  PlatformWeatherForecastRequest,
  PlatformWeatherForecastResponse,
  PlatformWeatherLocation,
  PlatformWeatherSearchRequest,
  PlatformWeatherSearchResponse,
  PlatformWeatherServiceStatus,
  PlatformWeatherTestResponse,
} from '@wapcentral/types';
import { getFirestoreDb } from '../../services/firestore.js';
import { getInternalSecret } from '../../services/secretVault.js';

// ============================================================
// Types & Cache Structures
// ============================================================

interface CacheEntry<T> {
  data: T;
  cachedAt: number; // Epoch ms
  expiresAt: number; // Epoch ms
  ttlSeconds: number;
}

const memoryCache = new Map<string, CacheEntry<any>>();

// Monthly call tracker for WeatherAPI free tier (100,000 calls/month)
interface MonthlyUsageTracker {
  monthKey: string; // e.g. "2026-11"
  totalCalls: number;
  perAppCalls: Record<string, number>;
  lastResetAt: string;
}

let monthlyTracker: MonthlyUsageTracker = {
  monthKey: getMonthKey(),
  totalCalls: 0,
  perAppCalls: {},
  lastResetAt: new Date().toISOString(),
};

function getMonthKey(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
}

function checkAndRotateMonthlyTracker(): void {
  const currentMonth = getMonthKey();
  if (monthlyTracker.monthKey !== currentMonth) {
    monthlyTracker = {
      monthKey: currentMonth,
      totalCalls: 0,
      perAppCalls: {},
      lastResetAt: new Date().toISOString(),
    };
  }
}

// Test / mock adapter injection
let mockWeatherAdapter: ((endpoint: string, params: Record<string, string>, apiKey?: string) => Promise<any>) | null = null;

export function setMockWeatherAdapterForTest(
  adapter: ((endpoint: string, params: Record<string, string>, apiKey?: string) => Promise<any>) | null,
): void {
  mockWeatherAdapter = adapter;
}

export function clearWeatherCacheForTest(): void {
  memoryCache.clear();
}

export function resetWeatherUsageForTest(): void {
  monthlyTracker = {
    monthKey: getMonthKey(),
    totalCalls: 0,
    perAppCalls: {},
    lastResetAt: new Date().toISOString(),
  };
}

// ============================================================
// Provider Credential Resolution
// ============================================================

/**
 * Resolves the WeatherAPI key:
 * 1. App-specific key override in Secret Manager: WEATHER_API_KEY_<APP_ID>
 * 2. Global Secret Manager key: WEATHER_API_KEY
 * 3. Process environment variables
 */
export async function resolveWeatherApiKey(appId?: string): Promise<{
  apiKey: string | null;
  keySource: 'app_override' | 'global_secret_manager' | 'none';
}> {
  if (appId) {
    const appSecretName = `WEATHER_API_KEY_${appId.toUpperCase().replace(/[^A-Z0-9]/g, '_')}`;
    const appKey = (await getInternalSecret(appSecretName)) || process.env[appSecretName];
    if (appKey && appKey.trim().length > 0) {
      return { apiKey: appKey.trim(), keySource: 'app_override' };
    }
  }

  const globalKey = (await getInternalSecret('WEATHER_API_KEY')) || process.env['WEATHER_API_KEY'];
  if (globalKey && globalKey.trim().length > 0) {
    return { apiKey: globalKey.trim(), keySource: 'global_secret_manager' };
  }

  return { apiKey: null, keySource: 'none' };
}

// ============================================================
// Cache Key Normalization
// ============================================================

export function buildCacheKey(
  type: 'current' | 'forecast' | 'search',
  params: {
    query?: string | undefined;
    latitude?: number | undefined;
    longitude?: number | undefined;
    days?: number | undefined;
    hour?: number | undefined;
    aqi?: boolean | undefined;
  },
): string {
  let locationPart = '';
  if (params.latitude !== undefined && params.longitude !== undefined) {
    // Round to 3 decimal places (~110 meters) for spatial caching
    const latRounded = params.latitude.toFixed(3);
    const lonRounded = params.longitude.toFixed(3);
    locationPart = `geo:${latRounded},${lonRounded}`;
  } else if (params.query) {
    locationPart = `q:${params.query.trim().toLowerCase()}`;
  }

  const aqiPart = params.aqi ? ':aqi' : '';
  const daysPart = params.days !== undefined ? `:d${params.days}` : '';
  const hourPart = params.hour !== undefined ? `:h${params.hour}` : '';

  return `weather:${type}:${locationPart}${daysPart}${hourPart}${aqiPart}`;
}

function getFromCache<T>(cacheKey: string): { data: T; metadata: PlatformWeatherCacheMetadata } | null {
  const entry = memoryCache.get(cacheKey);
  if (!entry) return null;

  const now = Date.now();
  if (now > entry.expiresAt) {
    memoryCache.delete(cacheKey);
    return null;
  }

  const ageSeconds = Math.floor((now - entry.cachedAt) / 1000);
  return {
    data: entry.data,
    metadata: {
      cached: true,
      cacheKey,
      cacheTtlSeconds: entry.ttlSeconds,
      cacheExpiresAt: new Date(entry.expiresAt).toISOString(),
      cacheAgeSeconds: ageSeconds,
    },
  };
}

function setToCache<T>(cacheKey: string, data: T, ttlSeconds: number): PlatformWeatherCacheMetadata {
  const now = Date.now();
  const expiresAt = now + ttlSeconds * 1000;
  memoryCache.set(cacheKey, {
    data,
    cachedAt: now,
    expiresAt,
    ttlSeconds,
  });

  return {
    cached: false,
    cacheKey,
    cacheTtlSeconds: ttlSeconds,
    cacheExpiresAt: new Date(expiresAt).toISOString(),
    cacheAgeSeconds: 0,
  };
}

// ============================================================
// Normalization Helpers
// ============================================================

export function getAttribution(): PlatformWeatherAttribution {
  return {
    provider: WEATHER_CONFIG.ATTRIBUTION.PROVIDER,
    text: WEATHER_CONFIG.ATTRIBUTION.TEXT,
    url: WEATHER_CONFIG.ATTRIBUTION.URL,
    required: WEATHER_CONFIG.ATTRIBUTION.REQUIRED,
    disclaimer: WEATHER_CONFIG.ATTRIBUTION.DISCLAIMER,
  };
}

export function normalizeLocation(raw: any): PlatformWeatherLocation {
  return {
    name: String(raw?.name || 'Unknown Location'),
    region: String(raw?.region || ''),
    country: String(raw?.country || ''),
    latitude: Number(raw?.lat || 0),
    longitude: Number(raw?.lon || 0),
    timezone: String(raw?.tz_id || 'UTC'),
    localtime: String(raw?.localtime || ''),
    localtimeEpoch: Number(raw?.localtime_epoch || 0),
  };
}

export function normalizeCurrent(rawLoc: any, rawCurrent: any): PlatformCurrentWeather {
  const loc = normalizeLocation(rawLoc);
  const isDay = rawCurrent?.is_day === 1;

  let airQuality: any = undefined;
  if (rawCurrent?.air_quality) {
    const aq = rawCurrent.air_quality;
    airQuality = {
      co: aq.co !== undefined ? Number(aq.co) : undefined,
      no2: aq.no2 !== undefined ? Number(aq.no2) : undefined,
      o3: aq.o3 !== undefined ? Number(aq.o3) : undefined,
      so2: aq.so2 !== undefined ? Number(aq.so2) : undefined,
      pm2_5: aq.pm2_5 !== undefined ? Number(aq.pm2_5) : undefined,
      pm10: aq.pm10 !== undefined ? Number(aq.pm10) : undefined,
      usEpaIndex: aq['us-epa-index'] !== undefined ? Number(aq['us-epa-index']) : undefined,
      gbDefraIndex: aq['gb-defra-index'] !== undefined ? Number(aq['gb-defra-index']) : undefined,
    };
  }

  return {
    location: loc,
    temperatureC: Number(rawCurrent?.temp_c ?? 0),
    temperatureF: Number(rawCurrent?.temp_f ?? 0),
    feelsLikeC: Number(rawCurrent?.feelslike_c ?? rawCurrent?.temp_c ?? 0),
    feelsLikeF: Number(rawCurrent?.feelslike_f ?? rawCurrent?.temp_f ?? 0),
    condition: {
      text: String(rawCurrent?.condition?.text || 'Clear'),
      icon: String(rawCurrent?.condition?.icon || ''),
      code: Number(rawCurrent?.condition?.code || 1000),
    },
    windKph: Number(rawCurrent?.wind_kph ?? 0),
    windMph: Number(rawCurrent?.wind_mph ?? 0),
    windDegree: Number(rawCurrent?.wind_degree ?? 0),
    windDirection: String(rawCurrent?.wind_dir || 'N'),
    pressureMb: Number(rawCurrent?.pressure_mb ?? 1013),
    pressureIn: Number(rawCurrent?.pressure_in ?? 29.92),
    precipMm: Number(rawCurrent?.precip_mm ?? 0),
    precipIn: Number(rawCurrent?.precip_in ?? 0),
    humidity: Number(rawCurrent?.humidity ?? 0),
    cloud: Number(rawCurrent?.cloud ?? 0),
    isDay,
    uvIndex: Number(rawCurrent?.uv ?? 0),
    visibilityKm: Number(rawCurrent?.vis_km ?? 10),
    visibilityMiles: Number(rawCurrent?.vis_miles ?? 6),
    gustKph: rawCurrent?.gust_kph !== undefined ? Number(rawCurrent.gust_kph) : undefined,
    gustMph: rawCurrent?.gust_mph !== undefined ? Number(rawCurrent.gust_mph) : undefined,
    airQuality,
    lastUpdated: String(rawCurrent?.last_updated || new Date().toISOString()),
    lastUpdatedEpoch: Number(rawCurrent?.last_updated_epoch || Math.floor(Date.now() / 1000)),
  };
}

export function normalizeForecast(raw: any): PlatformWeatherForecast {
  const current = normalizeCurrent(raw?.location, raw?.current);
  const location = normalizeLocation(raw?.location);

  const forecastDays: PlatformForecastDay[] = (raw?.forecast?.forecastday || []).map((fd: any) => {
    const daySummary = {
      maxTempC: Number(fd?.day?.maxtemp_c ?? 0),
      maxTempF: Number(fd?.day?.maxtemp_f ?? 0),
      minTempC: Number(fd?.day?.mintemp_c ?? 0),
      minTempF: Number(fd?.day?.mintemp_f ?? 0),
      avgTempC: Number(fd?.day?.avgtemp_c ?? 0),
      avgTempF: Number(fd?.day?.avgtemp_f ?? 0),
      maxWindKph: Number(fd?.day?.maxwind_kph ?? 0),
      maxWindMph: Number(fd?.day?.maxwind_mph ?? 0),
      totalPrecipMm: Number(fd?.day?.totalprecip_mm ?? 0),
      totalPrecipIn: Number(fd?.day?.totalprecip_in ?? 0),
      avgHumidity: Number(fd?.day?.avghumidity ?? 0),
      condition: {
        text: String(fd?.day?.condition?.text || 'Clear'),
        icon: String(fd?.day?.condition?.icon || ''),
        code: Number(fd?.day?.condition?.code || 1000),
      },
      uvIndex: Number(fd?.day?.uv ?? 0),
      chanceOfRainPct: Number(fd?.day?.daily_chance_of_rain ?? 0),
      chanceOfSnowPct: Number(fd?.day?.daily_chance_of_snow ?? 0),
    };

    const astro = {
      sunrise: String(fd?.astro?.sunrise || ''),
      sunset: String(fd?.astro?.sunset || ''),
      moonrise: String(fd?.astro?.moonrise || ''),
      moonset: String(fd?.astro?.moonset || ''),
      moonPhase: String(fd?.astro?.moon_phase || ''),
      moonIllumination: fd?.astro?.moon_illumination ?? 0,
    };

    const hourly: PlatformForecastHour[] = (fd?.hour || []).map((h: any) => ({
      time: String(h?.time || ''),
      timeEpoch: Number(h?.time_epoch || 0),
      tempC: Number(h?.temp_c ?? 0),
      tempF: Number(h?.temp_f ?? 0),
      feelsLikeC: Number(h?.feelslike_c ?? h?.temp_c ?? 0),
      feelsLikeF: Number(h?.feelslike_f ?? h?.temp_f ?? 0),
      condition: {
        text: String(h?.condition?.text || 'Clear'),
        icon: String(h?.condition?.icon || ''),
        code: Number(h?.condition?.code || 1000),
      },
      windKph: Number(h?.wind_kph ?? 0),
      windMph: Number(h?.wind_mph ?? 0),
      windDegree: Number(h?.wind_degree ?? 0),
      windDirection: String(h?.wind_dir || 'N'),
      pressureMb: Number(h?.pressure_mb ?? 1013),
      humidity: Number(h?.humidity ?? 0),
      cloud: Number(h?.cloud ?? 0),
      chanceOfRainPct: Number(h?.chance_of_rain ?? 0),
      chanceOfSnowPct: Number(h?.chance_of_snow ?? 0),
      isDay: h?.is_day === 1,
      uvIndex: Number(h?.uv ?? 0),
    }));

    return {
      date: String(fd?.date || ''),
      dateEpoch: Number(fd?.date_epoch || 0),
      day: daySummary,
      astro,
      hourly,
    };
  });

  const alerts = (raw?.alerts?.alert || []).map((a: any) => ({
    headline: String(a?.headline || ''),
    severity: String(a?.severity || ''),
    urgency: String(a?.urgency || ''),
    areas: String(a?.areas || ''),
    category: String(a?.category || ''),
    certainty: String(a?.certainty || ''),
    event: String(a?.event || ''),
    note: String(a?.note || ''),
    effective: String(a?.effective || ''),
    expires: String(a?.expires || ''),
    desc: String(a?.desc || ''),
    instruction: String(a?.instruction || ''),
  }));

  return {
    location,
    current,
    forecastDays,
    alerts: alerts.length > 0 ? alerts : undefined,
  };
}

export function normalizeSearchResults(raw: any[]): PlatformLocationSearchResult[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((item: any) => ({
    id: Number(item?.id || 0),
    name: String(item?.name || ''),
    region: String(item?.region || ''),
    country: String(item?.country || ''),
    latitude: Number(item?.lat || 0),
    longitude: Number(item?.lon || 0),
    url: item?.url ? String(item.url) : undefined,
  }));
}

// ============================================================
// WeatherAPI HTTP Requester
// ============================================================

async function callWeatherApi(
  endpoint: 'current.json' | 'forecast.json' | 'search.json',
  params: Record<string, string>,
  apiKey: string,
  appId?: string,
): Promise<{ data: any; latencyMs: number }> {
  if (mockWeatherAdapter) {
    checkAndRotateMonthlyTracker();
    monthlyTracker.totalCalls += 1;
    if (appId) {
      monthlyTracker.perAppCalls[appId] = (monthlyTracker.perAppCalls[appId] || 0) + 1;
    }

    const mockResult = await mockWeatherAdapter(endpoint, params, apiKey);
    if (mockResult?.error) {
      const errorCode = mockResult.error.code;
      const errorMessage = mockResult.error.message || 'WeatherAPI error';

      switch (errorCode) {
        case 1002: // API key not provided
        case 2006: // API key provided is invalid
          throw new WeatherServiceError('PROVIDER_AUTH_ERROR', `WeatherAPI authentication failed: ${errorMessage}`, 502);
        case 2007: // Quota exceeded
          throw new WeatherServiceError(
            'PROVIDER_QUOTA_EXCEEDED',
            `WeatherAPI monthly quota of 100,000 calls exceeded. ${errorMessage}`,
            429,
          );
        case 2008: // API key disabled
          throw new WeatherServiceError('PROVIDER_DISABLED', `WeatherAPI key is disabled: ${errorMessage}`, 502);
        case 1006: // No location found
          throw new WeatherServiceError('LOCATION_NOT_FOUND', `No weather location found: ${errorMessage}`, 404);
        case 1003: // Parameter 'q' not provided
        case 1005: // API request url is invalid
          throw new WeatherServiceError('INVALID_REQUEST', `WeatherAPI request invalid: ${errorMessage}`, 400);
        default:
          throw new WeatherServiceError('PROVIDER_ERROR', `WeatherAPI error (${errorCode}): ${errorMessage}`, 502);
      }
    }

    return { data: mockResult, latencyMs: 5 };
  }

  const queryParams = new URLSearchParams({
    key: apiKey,
    ...params,
  });

  const url = `${WEATHER_CONFIG.BASE_URL}/${endpoint}?${queryParams.toString()}`;
  const startTime = Date.now();

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'WAPCentral-WeatherGateway/1.0',
      },
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    throw new WeatherServiceError('PROVIDER_UNAVAILABLE', `Failed to connect to WeatherAPI.com: ${errorMsg}`, 503);
  }

  const latencyMs = Date.now() - startTime;
  const rawData: any = await response.json().catch(() => null);

  // Track call in monthly tracker if request reached the provider
  checkAndRotateMonthlyTracker();
  monthlyTracker.totalCalls += 1;
  if (appId) {
    monthlyTracker.perAppCalls[appId] = (monthlyTracker.perAppCalls[appId] || 0) + 1;
  }

  if (!response.ok || rawData?.error) {
    const errorCode = rawData?.error?.code;
    const errorMessage = rawData?.error?.message || response.statusText || 'WeatherAPI error';

    // Map WeatherAPI error codes
    switch (errorCode) {
      case 1002: // API key not provided
      case 2006: // API key provided is invalid
        throw new WeatherServiceError('PROVIDER_AUTH_ERROR', `WeatherAPI authentication failed: ${errorMessage}`, 502);
      case 2007: // Quota exceeded
        throw new WeatherServiceError(
          'PROVIDER_QUOTA_EXCEEDED',
          `WeatherAPI monthly quota of 100,000 calls exceeded. ${errorMessage}`,
          429,
        );
      case 2008: // API key disabled
        throw new WeatherServiceError('PROVIDER_DISABLED', `WeatherAPI key is disabled: ${errorMessage}`, 502);
      case 1006: // No location found
        throw new WeatherServiceError('LOCATION_NOT_FOUND', `No weather location found: ${errorMessage}`, 404);
      case 1003: // Parameter 'q' not provided
      case 1005: // API request url is invalid
        throw new WeatherServiceError('INVALID_REQUEST', `WeatherAPI request invalid: ${errorMessage}`, 400);
      default:
        throw new WeatherServiceError('PROVIDER_ERROR', `WeatherAPI error (${errorCode || response.status}): ${errorMessage}`, 502);
    }
  }

  return { data: rawData, latencyMs };
}

export class WeatherServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly statusCode: number = 500,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'WeatherServiceError';
  }
}

// ============================================================
// Service Operations
// ============================================================

/**
 * Resolves location parameter for WeatherAPI.com
 * Supports:
 * - City name (e.g. "Tokyo", "London", "New York")
 * - Postal code / Zipcode
 * - Lat/Long coordinates ("35.6762,139.6503")
 */
function resolveQueryParam(req: { query?: string | undefined; latitude?: number | undefined; longitude?: number | undefined }): string {
  if (req.latitude !== undefined && req.longitude !== undefined) {
    return `${req.latitude},${req.longitude}`;
  }
  if (req.query && req.query.trim().length > 0) {
    return req.query.trim();
  }
  throw new WeatherServiceError('VALIDATION_ERROR', 'A location query or latitude/longitude coordinates must be provided.', 400);
}

/**
 * GET/POST Current Weather
 */
export async function executeWeatherCurrent(
  request: PlatformWeatherCurrentRequest,
  platformRequestId: string,
  app: App,
): Promise<{
  data: PlatformWeatherCurrentResponse;
  executionSource: PlatformExecutionSource;
  latencyMs: number;
}> {
  const queryParam = resolveQueryParam(request);
  const cacheKey = buildCacheKey('current', {
    query: request.query,
    latitude: request.latitude,
    longitude: request.longitude,
    aqi: request.aqi,
  });

  // Check cache unless forceRefresh requested
  if (!request.forceRefresh) {
    const cached = getFromCache<PlatformCurrentWeather>(cacheKey);
    if (cached) {
      return {
        data: {
          weather: cached.data,
          attribution: getAttribution(),
          cache: cached.metadata,
        },
        executionSource: 'wap_engine',
        latencyMs: 1,
      };
    }
  }

  // Resolve API Key
  const { apiKey } = await resolveWeatherApiKey(app.id);
  if (!apiKey) {
    throw new WeatherServiceError(
      'PROVIDER_CREDENTIALS_MISSING',
      'WeatherAPI credentials are not configured in Secret Manager (WEATHER_API_KEY).',
      503,
    );
  }

  const params: Record<string, string> = {
    q: queryParam,
    aqi: request.aqi ? 'yes' : 'no',
  };

  const startTime = Date.now();
  const { data: rawData, latencyMs: providerLatency } = await callWeatherApi('current.json', params, apiKey, app.id);
  const normalized = normalizeCurrent(rawData.location, rawData.current);

  // Cache response (30 mins = 1800s, within 60-min max limit)
  const cacheMeta = setToCache<PlatformCurrentWeather>(
    cacheKey,
    normalized,
    WEATHER_CONFIG.DEFAULT_CURRENT_CACHE_TTL_SECONDS,
  );

  return {
    data: {
      weather: normalized,
      attribution: getAttribution(),
      cache: cacheMeta,
    },
    executionSource: 'external_provider',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * GET/POST Weather Forecast (Daily & Hourly)
 */
export async function executeWeatherForecast(
  request: PlatformWeatherForecastRequest,
  platformRequestId: string,
  app: App,
): Promise<{
  data: PlatformWeatherForecastResponse;
  executionSource: PlatformExecutionSource;
  latencyMs: number;
}> {
  const queryParam = resolveQueryParam(request);
  const days = Math.min(request.days || WEATHER_CONFIG.MAX_FORECAST_DAYS_FREE_TIER, WEATHER_CONFIG.MAX_FORECAST_DAYS_FREE_TIER);
  const cacheKey = buildCacheKey('forecast', {
    query: request.query,
    latitude: request.latitude,
    longitude: request.longitude,
    days,
    hour: request.hour,
    aqi: request.aqi,
  });

  if (!request.forceRefresh) {
    const cached = getFromCache<PlatformWeatherForecast>(cacheKey);
    if (cached) {
      return {
        data: {
          forecast: cached.data,
          attribution: getAttribution(),
          cache: cached.metadata,
        },
        executionSource: 'wap_engine',
        latencyMs: 1,
      };
    }
  }

  const { apiKey } = await resolveWeatherApiKey(app.id);
  if (!apiKey) {
    throw new WeatherServiceError(
      'PROVIDER_CREDENTIALS_MISSING',
      'WeatherAPI credentials are not configured in Secret Manager (WEATHER_API_KEY).',
      503,
    );
  }

  const params: Record<string, string> = {
    q: queryParam,
    days: String(days),
    aqi: request.aqi ? 'yes' : 'no',
    alerts: request.alerts ? 'yes' : 'no',
  };
  if (request.hour !== undefined) {
    params['hour'] = String(request.hour);
  }

  const startTime = Date.now();
  const { data: rawData, latencyMs: providerLatency } = await callWeatherApi('forecast.json', params, apiKey, app.id);
  const normalized = normalizeForecast(rawData);

  // Cache forecast (6 hours = 21600s, within 24-hr max limit)
  const cacheMeta = setToCache<PlatformWeatherForecast>(
    cacheKey,
    normalized,
    WEATHER_CONFIG.DEFAULT_FORECAST_CACHE_TTL_SECONDS,
  );

  return {
    data: {
      forecast: normalized,
      attribution: getAttribution(),
      cache: cacheMeta,
    },
    executionSource: 'external_provider',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * GET/POST Location Search / Autocomplete
 */
export async function executeWeatherSearch(
  request: PlatformWeatherSearchRequest,
  platformRequestId: string,
  app: App,
): Promise<{
  data: PlatformWeatherSearchResponse;
  executionSource: PlatformExecutionSource;
  latencyMs: number;
}> {
  if (!request.query || request.query.trim().length < 2) {
    throw new WeatherServiceError('VALIDATION_ERROR', 'Search query must be at least 2 characters.', 400);
  }

  const cacheKey = buildCacheKey('search', { query: request.query });
  const cached = getFromCache<PlatformLocationSearchResult[]>(cacheKey);
  if (cached) {
    return {
      data: {
        results: cached.data,
        attribution: getAttribution(),
        cache: cached.metadata,
      },
      executionSource: 'wap_engine',
      latencyMs: 1,
    };
  }

  const { apiKey } = await resolveWeatherApiKey(app.id);
  if (!apiKey) {
    throw new WeatherServiceError(
      'PROVIDER_CREDENTIALS_MISSING',
      'WeatherAPI credentials are not configured in Secret Manager (WEATHER_API_KEY).',
      503,
    );
  }

  const startTime = Date.now();
  const { data: rawData, latencyMs: providerLatency } = await callWeatherApi(
    'search.json',
    { q: request.query.trim() },
    apiKey,
    app.id,
  );
  const normalized = normalizeSearchResults(rawData);

  // Cache search results for 24 hours
  const cacheMeta = setToCache<PlatformLocationSearchResult[]>(
    cacheKey,
    normalized,
    WEATHER_CONFIG.DEFAULT_SEARCH_CACHE_TTL_SECONDS,
  );

  return {
    data: {
      results: normalized,
      attribution: getAttribution(),
      cache: cacheMeta,
    },
    executionSource: 'external_provider',
    latencyMs: Date.now() - startTime,
  };
}

/**
 * Diagnostic Test Provider Connection
 */
export async function testWeatherConnection(
  explicitKey?: string,
  queryLocation: string = 'London',
  appId?: string,
): Promise<PlatformWeatherTestResponse> {
  const startTime = Date.now();
  let keyToUse = explicitKey;
  let keySource: 'app_override' | 'global_secret_manager' | 'test_param' | 'none' = 'test_param';

  if (!keyToUse) {
    const resolved = await resolveWeatherApiKey(appId);
    keyToUse = resolved.apiKey || undefined;
    keySource = resolved.keySource;
  }

  if (!keyToUse) {
    return {
      success: false,
      provider: WEATHER_CONFIG.PROVIDER,
      providerKeySource: 'none',
      latencyMs: 0,
      error: 'No WeatherAPI key provided or found in Secret Manager (WEATHER_API_KEY).',
      timestamp: new Date().toISOString(),
    };
  }

  try {
    const { data } = await callWeatherApi('current.json', { q: queryLocation }, keyToUse, appId);
    const latencyMs = Date.now() - startTime;
    return {
      success: true,
      provider: WEATHER_CONFIG.PROVIDER,
      providerKeySource: keySource,
      latencyMs,
      location: data?.location?.name,
      country: data?.location?.country,
      tempC: data?.current?.temp_c,
      condition: data?.current?.condition?.text,
      timestamp: new Date().toISOString(),
    };
  } catch (err: unknown) {
    const latencyMs = Date.now() - startTime;
    const msg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      provider: WEATHER_CONFIG.PROVIDER,
      providerKeySource: keySource,
      latencyMs,
      error: msg,
      timestamp: new Date().toISOString(),
    };
  }
}

/**
 * Returns Weather Service Status and Usage Metrics for Admin Dashboard
 */
export async function getWeatherServiceStatus(appId?: string): Promise<PlatformWeatherServiceStatus> {
  checkAndRotateMonthlyTracker();
  const { apiKey } = await resolveWeatherApiKey(appId);

  const monthlyQuota = WEATHER_CONFIG.FREE_TIER_MONTHLY_QUOTA;
  const monthlyUsage = monthlyTracker.totalCalls;
  const remainingQuota = Math.max(0, monthlyQuota - monthlyUsage);

  // Compute next month reset date (1st of next month UTC)
  const now = new Date();
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 0, 0, 0));

  return {
    enabled: true,
    globalConfigured: Boolean(apiKey),
    activeProvider: WEATHER_CONFIG.PROVIDER,
    monthlyQuota,
    monthlyUsage,
    remainingQuota,
    quotaResetDate: nextMonth.toISOString(),
    cacheActiveEntries: memoryCache.size,
    attribution: getAttribution(),
    timestamp: new Date().toISOString(),
  };
}
