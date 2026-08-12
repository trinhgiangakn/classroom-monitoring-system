const { HANOI_WEATHER } = require('./weather.constants');

/**
 * Authenticated read API. It deliberately reads only the stored fresh snapshot;
 * scheduled sync is the sole place that calls the external weather provider.
 */
function createWeatherRouter({ Router, authenticate, afterAuthenticate, weatherContext }) {
  const router = Router();

  router.get('/weather/current', authenticate, afterAuthenticate, async (req, res, next) => {
    try {
      const roomId = req.query.room_id || HANOI_WEATHER.roomId;
      const snapshot = await weatherContext.getFreshLatest(roomId);
      return res.status(200).json({ success: true, room_id: roomId, data: snapshot });
    } catch (error) {
      return next(error);
    }
  });

  return router;
}

module.exports = { createWeatherRouter };
