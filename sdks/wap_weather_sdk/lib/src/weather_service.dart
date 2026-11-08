import 'package:wap_core_sdk/wap_core_sdk.dart';
import 'weather_models.dart';

/// Centralized Weather Service client for mobile applications.
/// Mediated through WAPCentral with zero mobile provider key exposure.
class WapWeather {
  final WapClient _client;

  WapWeather({
    required WapConfig config,
    WapClient? client,
  }) : _client = client ?? WapClient(config: config);

  /// Fetches real-time current weather conditions.
  /// Accepts either [query] (city/region name or postal code) or [latitude] & [longitude].
  Future<WapResponse<WeatherCurrentData>> getCurrentWeather({
    String? query,
    double? latitude,
    double? longitude,
    bool aqi = false,
    bool forceRefresh = false,
  }) {
    if (query == null && (latitude == null || longitude == null)) {
      throw ArgumentError('Either query (city name) or both latitude and longitude must be provided.');
    }

    return _client.post<WeatherCurrentData>(
      path: '/weather/current',
      body: {
        if (query != null) 'query': query,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        'aqi': aqi,
        'forceRefresh': forceRefresh,
      },
      dataParser: (d) => WeatherCurrentData.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Fetches daily and hourly forecasts (up to 3 days on free tier).
  /// Accepts either [query] or [latitude] & [longitude].
  Future<WapResponse<WeatherForecastData>> getForecast({
    String? query,
    double? latitude,
    double? longitude,
    int days = 3,
    int? hour,
    bool aqi = false,
    bool alerts = false,
    bool forceRefresh = false,
  }) {
    if (query == null && (latitude == null || longitude == null)) {
      throw ArgumentError('Either query (city name) or both latitude and longitude must be provided.');
    }

    return _client.post<WeatherForecastData>(
      path: '/weather/forecast',
      body: {
        if (query != null) 'query': query,
        if (latitude != null) 'latitude': latitude,
        if (longitude != null) 'longitude': longitude,
        'days': days,
        if (hour != null) 'hour': hour,
        'aqi': aqi,
        'alerts': alerts,
        'forceRefresh': forceRefresh,
      },
      dataParser: (d) => WeatherForecastData.fromJson(d as Map<String, dynamic>),
    );
  }

  /// Searches for matching locations worldwide for autocomplete.
  Future<WapResponse<WeatherSearchData>> searchLocations(String query) {
    if (query.trim().length < 2) {
      throw ArgumentError('Search query must be at least 2 characters.');
    }

    return _client.post<WeatherSearchData>(
      path: '/weather/search',
      body: {
        'query': query.trim(),
      },
      dataParser: (d) => WeatherSearchData.fromJson(d as Map<String, dynamic>),
    );
  }
}
