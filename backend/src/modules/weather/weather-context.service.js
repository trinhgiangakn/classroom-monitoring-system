const { WEATHER_FRESHNESS_MS } = require('./weather.constants');

/** Provides a bounded-age external context for advisory use only. */
class WeatherContextService {
  constructor({ provider, repository, now = () => new Date(), freshnessMs = WEATHER_FRESHNESS_MS }) {
    this.provider = provider;
    this.repository = repository;
    this.now = now;
    this.freshnessMs = freshnessMs;
  }

  async refresh(roomId) {
    const snapshot = await this.provider.fetchCurrent(roomId);
    return this.repository.insertOrUpdate(snapshot);
  }

  async getFreshLatest(roomId) {
    const snapshot = await this.repository.findLatest(roomId);
    if (!snapshot) return null;

    const fetchedAt = new Date(snapshot.fetchedAt).getTime();
    const ageMs = this.now().getTime() - fetchedAt;
    if (!Number.isFinite(fetchedAt) || ageMs > this.freshnessMs) return null;
    return snapshot;
  }
}

module.exports = { WeatherContextService };
