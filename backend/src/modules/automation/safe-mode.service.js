const SAFE_MODE_STATE = Object.freeze({ NORMAL: 'NORMAL', SAFE_MODE: 'SAFE_MODE' });

/** Safe Mode becomes active when two or more sensor nodes are offline. */
function evaluateSafeMode(roomId, nodeStatuses, previousState, offlineThreshold = 2) {
  const offlineNodeIds = nodeStatuses
    .filter((node) => node.roomId === roomId && node.status === 'OFFLINE')
    .map((node) => node.nodeId);
  const currentState = offlineNodeIds.length >= offlineThreshold
    ? SAFE_MODE_STATE.SAFE_MODE
    : SAFE_MODE_STATE.NORMAL;

  return { roomId, previousState, currentState, offlineNodeIds, changed: previousState !== currentState };
}

module.exports = { SAFE_MODE_STATE, evaluateSafeMode };
