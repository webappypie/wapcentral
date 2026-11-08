/// Strongly-typed weather data models matching the normalized WAPCentral Weather schema.

class WeatherLocation {
  final String name;
  final String region;
  final String country;
  final double latitude;
  final double longitude;
  final String timezone;
  final String localtime;
  final int localtimeEpoch;

  const WeatherLocation({
    required this.name,
    required this.region,
    required this.country,
    required this.latitude,
    required this.longitude,
    required this.timezone,
    required this.localtime,
    required this.localtimeEpoch,
  });

  factory WeatherLocation.fromJson(Map<String, dynamic> json) {
    return WeatherLocation(
      name: json['name'] as String? ?? '',
      region: json['region'] as String? ?? '',
      country: json['country'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      timezone: json['timezone'] as String? ?? 'UTC',
      localtime: json['localtime'] as String? ?? '',
      localtimeEpoch: (json['localtimeEpoch'] as num?)?.toInt() ?? 0,
    );
  }

  Map<String, dynamic> toJson() => {
        'name': name,
        'region': region,
        'country': country,
        'latitude': latitude,
        'longitude': longitude,
        'timezone': timezone,
        'localtime': localtime,
        'localtimeEpoch': localtimeEpoch,
      };
}

class WeatherCondition {
  final String text;
  final String icon;
  final int code;

  const WeatherCondition({
    required this.text,
    required this.icon,
    required this.code,
  });

  factory WeatherCondition.fromJson(Map<String, dynamic> json) {
    return WeatherCondition(
      text: json['text'] as String? ?? 'Clear',
      icon: json['icon'] as String? ?? '',
      code: (json['code'] as num?)?.toInt() ?? 1000,
    );
  }

  Map<String, dynamic> toJson() => {
        'text': text,
        'icon': icon,
        'code': code,
      };
}

class WeatherAirQuality {
  final double? co;
  final double? no2;
  final double? o3;
  final double? so2;
  final double? pm2_5;
  final double? pm10;
  final int? usEpaIndex;
  final int? gbDefraIndex;

  const WeatherAirQuality({
    this.co,
    this.no2,
    this.o3,
    this.so2,
    this.pm2_5,
    this.pm10,
    this.usEpaIndex,
    this.gbDefraIndex,
  });

  factory WeatherAirQuality.fromJson(Map<String, dynamic> json) {
    return WeatherAirQuality(
      co: (json['co'] as num?)?.toDouble(),
      no2: (json['no2'] as num?)?.toDouble(),
      o3: (json['o3'] as num?)?.toDouble(),
      so2: (json['so2'] as num?)?.toDouble(),
      pm2_5: (json['pm2_5'] as num?)?.toDouble(),
      pm10: (json['pm10'] as num?)?.toDouble(),
      usEpaIndex: (json['usEpaIndex'] as num?)?.toInt(),
      gbDefraIndex: (json['gbDefraIndex'] as num?)?.toInt(),
    );
  }
}

class CurrentWeather {
  final WeatherLocation location;
  final double temperatureC;
  final double temperatureF;
  final double feelsLikeC;
  final double feelsLikeF;
  final WeatherCondition condition;
  final double windKph;
  final double windMph;
  final int windDegree;
  final String windDirection;
  final double pressureMb;
  final double pressureIn;
  final double precipMm;
  final double precipIn;
  final int humidity;
  final int cloud;
  final bool isDay;
  final double uvIndex;
  final double visibilityKm;
  final double visibilityMiles;
  final double? gustKph;
  final double? gustMph;
  final WeatherAirQuality? airQuality;
  final String lastUpdated;
  final int lastUpdatedEpoch;

  const CurrentWeather({
    required this.location,
    required this.temperatureC,
    required this.temperatureF,
    required this.feelsLikeC,
    required this.feelsLikeF,
    required this.condition,
    required this.windKph,
    required this.windMph,
    required this.windDegree,
    required this.windDirection,
    required this.pressureMb,
    required this.pressureIn,
    required this.precipMm,
    required this.precipIn,
    required this.humidity,
    required this.cloud,
    required this.isDay,
    required this.uvIndex,
    required this.visibilityKm,
    required this.visibilityMiles,
    this.gustKph,
    this.gustMph,
    this.airQuality,
    required this.lastUpdated,
    required this.lastUpdatedEpoch,
  });

  factory CurrentWeather.fromJson(Map<String, dynamic> json) {
    return CurrentWeather(
      location: WeatherLocation.fromJson(json['location'] as Map<String, dynamic>? ?? {}),
      temperatureC: (json['temperatureC'] as num?)?.toDouble() ?? 0.0,
      temperatureF: (json['temperatureF'] as num?)?.toDouble() ?? 0.0,
      feelsLikeC: (json['feelsLikeC'] as num?)?.toDouble() ?? 0.0,
      feelsLikeF: (json['feelsLikeF'] as num?)?.toDouble() ?? 0.0,
      condition: WeatherCondition.fromJson(json['condition'] as Map<String, dynamic>? ?? {}),
      windKph: (json['windKph'] as num?)?.toDouble() ?? 0.0,
      windMph: (json['windMph'] as num?)?.toDouble() ?? 0.0,
      windDegree: (json['windDegree'] as num?)?.toInt() ?? 0,
      windDirection: json['windDirection'] as String? ?? 'N',
      pressureMb: (json['pressureMb'] as num?)?.toDouble() ?? 1013.0,
      pressureIn: (json['pressureIn'] as num?)?.toDouble() ?? 29.92,
      precipMm: (json['precipMm'] as num?)?.toDouble() ?? 0.0,
      precipIn: (json['precipIn'] as num?)?.toDouble() ?? 0.0,
      humidity: (json['humidity'] as num?)?.toInt() ?? 0,
      cloud: (json['cloud'] as num?)?.toInt() ?? 0,
      isDay: json['isDay'] as bool? ?? true,
      uvIndex: (json['uvIndex'] as num?)?.toDouble() ?? 0.0,
      visibilityKm: (json['visibilityKm'] as num?)?.toDouble() ?? 10.0,
      visibilityMiles: (json['visibilityMiles'] as num?)?.toDouble() ?? 6.0,
      gustKph: (json['gustKph'] as num?)?.toDouble(),
      gustMph: (json['gustMph'] as num?)?.toDouble(),
      airQuality: json['airQuality'] != null
          ? WeatherAirQuality.fromJson(json['airQuality'] as Map<String, dynamic>)
          : null,
      lastUpdated: json['lastUpdated'] as String? ?? '',
      lastUpdatedEpoch: (json['lastUpdatedEpoch'] as num?)?.toInt() ?? 0,
    );
  }
}

class ForecastDaySummary {
  final double maxTempC;
  final double maxTempF;
  final double minTempC;
  final double minTempF;
  final double avgTempC;
  final double avgTempF;
  final double maxWindKph;
  final double maxWindMph;
  final double totalPrecipMm;
  final double totalPrecipIn;
  final double avgHumidity;
  final WeatherCondition condition;
  final double uvIndex;
  final int chanceOfRainPct;
  final int chanceOfSnowPct;

  const ForecastDaySummary({
    required this.maxTempC,
    required this.maxTempF,
    required this.minTempC,
    required this.minTempF,
    required this.avgTempC,
    required this.avgTempF,
    required this.maxWindKph,
    required this.maxWindMph,
    required this.totalPrecipMm,
    required this.totalPrecipIn,
    required this.avgHumidity,
    required this.condition,
    required this.uvIndex,
    required this.chanceOfRainPct,
    required this.chanceOfSnowPct,
  });

  factory ForecastDaySummary.fromJson(Map<String, dynamic> json) {
    return ForecastDaySummary(
      maxTempC: (json['maxTempC'] as num?)?.toDouble() ?? 0.0,
      maxTempF: (json['maxTempF'] as num?)?.toDouble() ?? 0.0,
      minTempC: (json['minTempC'] as num?)?.toDouble() ?? 0.0,
      minTempF: (json['minTempF'] as num?)?.toDouble() ?? 0.0,
      avgTempC: (json['avgTempC'] as num?)?.toDouble() ?? 0.0,
      avgTempF: (json['avgTempF'] as num?)?.toDouble() ?? 0.0,
      maxWindKph: (json['maxWindKph'] as num?)?.toDouble() ?? 0.0,
      maxWindMph: (json['maxWindMph'] as num?)?.toDouble() ?? 0.0,
      totalPrecipMm: (json['totalPrecipMm'] as num?)?.toDouble() ?? 0.0,
      totalPrecipIn: (json['totalPrecipIn'] as num?)?.toDouble() ?? 0.0,
      avgHumidity: (json['avgHumidity'] as num?)?.toDouble() ?? 0.0,
      condition: WeatherCondition.fromJson(json['condition'] as Map<String, dynamic>? ?? {}),
      uvIndex: (json['uvIndex'] as num?)?.toDouble() ?? 0.0,
      chanceOfRainPct: (json['chanceOfRainPct'] as num?)?.toInt() ?? 0,
      chanceOfSnowPct: (json['chanceOfSnowPct'] as num?)?.toInt() ?? 0,
    );
  }
}

class ForecastAstro {
  final String sunrise;
  final String sunset;
  final String moonrise;
  final String moonset;
  final String moonPhase;
  final dynamic moonIllumination;

  const ForecastAstro({
    required this.sunrise,
    required this.sunset,
    required this.moonrise,
    required this.moonset,
    required this.moonPhase,
    required this.moonIllumination,
  });

  factory ForecastAstro.fromJson(Map<String, dynamic> json) {
    return ForecastAstro(
      sunrise: json['sunrise'] as String? ?? '',
      sunset: json['sunset'] as String? ?? '',
      moonrise: json['moonrise'] as String? ?? '',
      moonset: json['moonset'] as String? ?? '',
      moonPhase: json['moonPhase'] as String? ?? '',
      moonIllumination: json['moonIllumination'],
    );
  }
}

class ForecastHour {
  final String time;
  final int timeEpoch;
  final double tempC;
  final double tempF;
  final double feelsLikeC;
  final double feelsLikeF;
  final WeatherCondition condition;
  final double windKph;
  final double windMph;
  final int windDegree;
  final String windDirection;
  final double pressureMb;
  final int humidity;
  final int cloud;
  final int chanceOfRainPct;
  final int chanceOfSnowPct;
  final bool isDay;
  final double uvIndex;

  const ForecastHour({
    required this.time,
    required this.timeEpoch,
    required this.tempC,
    required this.tempF,
    required this.feelsLikeC,
    required this.feelsLikeF,
    required this.condition,
    required this.windKph,
    required this.windMph,
    required this.windDegree,
    required this.windDirection,
    required this.pressureMb,
    required this.humidity,
    required this.cloud,
    required this.chanceOfRainPct,
    required this.chanceOfSnowPct,
    required this.isDay,
    required this.uvIndex,
  });

  factory ForecastHour.fromJson(Map<String, dynamic> json) {
    return ForecastHour(
      time: json['time'] as String? ?? '',
      timeEpoch: (json['timeEpoch'] as num?)?.toInt() ?? 0,
      tempC: (json['tempC'] as num?)?.toDouble() ?? 0.0,
      tempF: (json['tempF'] as num?)?.toDouble() ?? 0.0,
      feelsLikeC: (json['feelsLikeC'] as num?)?.toDouble() ?? 0.0,
      feelsLikeF: (json['feelsLikeF'] as num?)?.toDouble() ?? 0.0,
      condition: WeatherCondition.fromJson(json['condition'] as Map<String, dynamic>? ?? {}),
      windKph: (json['windKph'] as num?)?.toDouble() ?? 0.0,
      windMph: (json['windMph'] as num?)?.toDouble() ?? 0.0,
      windDegree: (json['windDegree'] as num?)?.toInt() ?? 0,
      windDirection: json['windDirection'] as String? ?? 'N',
      pressureMb: (json['pressureMb'] as num?)?.toDouble() ?? 1013.0,
      humidity: (json['humidity'] as num?)?.toInt() ?? 0,
      cloud: (json['cloud'] as num?)?.toInt() ?? 0,
      chanceOfRainPct: (json['chanceOfRainPct'] as num?)?.toInt() ?? 0,
      chanceOfSnowPct: (json['chanceOfSnowPct'] as num?)?.toInt() ?? 0,
      isDay: json['isDay'] as bool? ?? true,
      uvIndex: (json['uvIndex'] as num?)?.toDouble() ?? 0.0,
    );
  }
}

class ForecastDay {
  final String date;
  final int dateEpoch;
  final ForecastDaySummary day;
  final ForecastAstro astro;
  final List<ForecastHour> hourly;

  const ForecastDay({
    required this.date,
    required this.dateEpoch,
    required this.day,
    required this.astro,
    required this.hourly,
  });

  factory ForecastDay.fromJson(Map<String, dynamic> json) {
    return ForecastDay(
      date: json['date'] as String? ?? '',
      dateEpoch: (json['dateEpoch'] as num?)?.toInt() ?? 0,
      day: ForecastDaySummary.fromJson(json['day'] as Map<String, dynamic>? ?? {}),
      astro: ForecastAstro.fromJson(json['astro'] as Map<String, dynamic>? ?? {}),
      hourly: ((json['hourly'] as List<dynamic>?) ?? [])
          .map((h) => ForecastHour.fromJson(h as Map<String, dynamic>))
          .toList(),
    );
  }
}

class WeatherForecast {
  final WeatherLocation location;
  final CurrentWeather current;
  final List<ForecastDay> forecastDays;

  const WeatherForecast({
    required this.location,
    required this.current,
    required this.forecastDays,
  });

  factory WeatherForecast.fromJson(Map<String, dynamic> json) {
    return WeatherForecast(
      location: WeatherLocation.fromJson(json['location'] as Map<String, dynamic>? ?? {}),
      current: CurrentWeather.fromJson(json['current'] as Map<String, dynamic>? ?? {}),
      forecastDays: ((json['forecastDays'] as List<dynamic>?) ?? [])
          .map((fd) => ForecastDay.fromJson(fd as Map<String, dynamic>))
          .toList(),
    );
  }
}

class LocationSearchResult {
  final int id;
  final String name;
  final String region;
  final String country;
  final double latitude;
  final double longitude;
  final String? url;

  const LocationSearchResult({
    required this.id,
    required this.name,
    required this.region,
    required this.country,
    required this.latitude,
    required this.longitude,
    this.url,
  });

  factory LocationSearchResult.fromJson(Map<String, dynamic> json) {
    return LocationSearchResult(
      id: (json['id'] as num?)?.toInt() ?? 0,
      name: json['name'] as String? ?? '',
      region: json['region'] as String? ?? '',
      country: json['country'] as String? ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 0.0,
      longitude: (json['longitude'] as num?)?.toDouble() ?? 0.0,
      url: json['url'] as String?,
    );
  }
}

class WeatherAttribution {
  final String provider;
  final String text;
  final String url;
  final bool required;
  final String disclaimer;

  const WeatherAttribution({
    required this.provider,
    required this.text,
    required this.url,
    required this.required,
    required this.disclaimer,
  });

  factory WeatherAttribution.fromJson(Map<String, dynamic> json) {
    return WeatherAttribution(
      provider: json['provider'] as String? ?? 'WeatherAPI.com',
      text: json['text'] as String? ?? 'Powered by WeatherAPI.com',
      url: json['url'] as String? ?? 'https://www.weatherapi.com/',
      required: json['required'] as bool? ?? true,
      disclaimer: json['disclaimer'] as String? ?? '',
    );
  }
}

class WeatherCurrentData {
  final CurrentWeather weather;
  final WeatherAttribution attribution;

  const WeatherCurrentData({
    required this.weather,
    required this.attribution,
  });

  factory WeatherCurrentData.fromJson(Map<String, dynamic> json) {
    return WeatherCurrentData(
      weather: CurrentWeather.fromJson(json['weather'] as Map<String, dynamic>? ?? {}),
      attribution: WeatherAttribution.fromJson(json['attribution'] as Map<String, dynamic>? ?? {}),
    );
  }
}

class WeatherForecastData {
  final WeatherForecast forecast;
  final WeatherAttribution attribution;

  const WeatherForecastData({
    required this.forecast,
    required this.attribution,
  });

  factory WeatherForecastData.fromJson(Map<String, dynamic> json) {
    return WeatherForecastData(
      forecast: WeatherForecast.fromJson(json['forecast'] as Map<String, dynamic>? ?? {}),
      attribution: WeatherAttribution.fromJson(json['attribution'] as Map<String, dynamic>? ?? {}),
    );
  }
}

class WeatherSearchData {
  final List<LocationSearchResult> results;
  final WeatherAttribution attribution;

  const WeatherSearchData({
    required this.results,
    required this.attribution,
  });

  factory WeatherSearchData.fromJson(Map<String, dynamic> json) {
    return WeatherSearchData(
      results: ((json['results'] as List<dynamic>?) ?? [])
          .map((r) => LocationSearchResult.fromJson(r as Map<String, dynamic>))
          .toList(),
      attribution: WeatherAttribution.fromJson(json['attribution'] as Map<String, dynamic>? ?? {}),
    );
  }
}
