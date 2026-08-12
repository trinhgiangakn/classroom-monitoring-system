function toNumberOrNull(value) {
  return value === null || value === undefined ? null : Number(value);
}

function parsePayload(value) {
  if (!value) return null;
  if (typeof value === 'object' && !Buffer.isBuffer(value)) return value;
  return JSON.parse(Buffer.isBuffer(value) ? value.toString('utf8') : value);
}

function mapWeatherRow(row) {
  if (!row) return null;
  return {
    id: Number(row.id),
    roomId: row.room_code,
    city: row.city,
    latitude: Number(row.latitude),
    longitude: Number(row.longitude),
    provider: row.provider,
    temperatureC: toNumberOrNull(row.temperature_c),
    humidityPercent: toNumberOrNull(row.humidity_percent),
    precipitationProbability: toNumberOrNull(row.precipitation_probability),
    precipitationMm: toNumberOrNull(row.precipitation_mm),
    windSpeedKmh: toNumberOrNull(row.wind_speed_kmh),
    weatherCode: toNumberOrNull(row.weather_code),
    observedAt: new Date(row.observed_at),
    fetchedAt: new Date(row.fetched_at),
    rawPayload: parsePayload(row.raw_payload),
  };
}

/** MySQL adapter for external weather context. It never writes device state. */
class MySqlWeatherRepository {
  constructor(database) {
    this.database = database;
  }

  async insertOrUpdate(snapshot) {
    const [result] = await this.database.query(
      `INSERT INTO external_weather_data (
        room_code, city, latitude, longitude, provider,
        temperature_c, humidity_percent, precipitation_probability,
        precipitation_mm, wind_speed_kmh, weather_code,
        observed_at, fetched_at, raw_payload
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        temperature_c = VALUES(temperature_c),
        humidity_percent = VALUES(humidity_percent),
        precipitation_probability = VALUES(precipitation_probability),
        precipitation_mm = VALUES(precipitation_mm),
        wind_speed_kmh = VALUES(wind_speed_kmh),
        weather_code = VALUES(weather_code),
        fetched_at = VALUES(fetched_at),
        raw_payload = VALUES(raw_payload)`,
      [
        snapshot.roomId,
        snapshot.city,
        snapshot.latitude,
        snapshot.longitude,
        snapshot.provider,
        snapshot.temperatureC,
        snapshot.humidityPercent,
        snapshot.precipitationProbability,
        snapshot.precipitationMm,
        snapshot.windSpeedKmh,
        snapshot.weatherCode,
        snapshot.observedAt,
        snapshot.fetchedAt,
        JSON.stringify(snapshot.rawPayload),
      ],
    );
    return { id: result.insertId, ...snapshot };
  }

  async findLatest(roomId) {
    const [rows] = await this.database.query(
      `SELECT id, room_code, city, latitude, longitude, provider,
              temperature_c, humidity_percent, precipitation_probability,
              precipitation_mm, wind_speed_kmh, weather_code,
              observed_at, fetched_at, raw_payload
       FROM external_weather_data
       WHERE room_code = ?
       ORDER BY fetched_at DESC, id DESC
       LIMIT 1`,
      [roomId],
    );
    return mapWeatherRow(rows[0]);
  }
}

module.exports = { MySqlWeatherRepository, mapWeatherRow };
