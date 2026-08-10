/**
 * Adapter between domain modules and the one Socket.io instance created by server.js.
 * Domain code calls this port; it never creates its own WebSocket server.
 */
function createRealtimePublisher(io, now = () => new Date()) {
  if (!io || typeof io.to !== 'function') {
    throw new TypeError('Socket.io instance with io.to(roomId) is required');
  }

  return {
    publishToRoom(roomId, { event, data }) {
      if (!roomId) throw new TypeError('roomId is required');
      if (!event) throw new TypeError('event is required');

      const payload = {
        room_id: roomId,
        occurred_at: now().toISOString(),
        data,
      };
      io.to(roomId).emit(event, payload);
      return payload;
    },
  };
}

module.exports = { createRealtimePublisher };
