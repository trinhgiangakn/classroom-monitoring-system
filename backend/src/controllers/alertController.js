const { ALERT_SEVERITY, ALERT_STATUS } = require('../modules/alerts/alert.constants');
const { REALTIME_EVENT } = require('../modules/realtime/realtime.events');

const VALID_SEVERITIES = new Set(Object.values(ALERT_SEVERITY));
const VALID_STATUSES = new Set(Object.values(ALERT_STATUS));
const VALID_VISIBILITIES = new Set(['visible', 'dismissed']);

function serializeAlert(alert) {
  return {
    id: alert.id,
    room_id: alert.roomId,
    type: alert.type,
    severity: alert.severity,
    source: alert.source,
    condition_key: alert.conditionKey,
    message: alert.message,
    status: alert.status,
    metadata: alert.metadata,
    created_at: alert.createdAt,
    acknowledged_by: alert.acknowledgedBy,
    acknowledged_at: alert.acknowledgedAt,
    resolved_by: alert.resolvedBy,
    resolved_at: alert.resolvedAt,
  };
}

function parseFilters(query) {
  const severity = query.severity?.toUpperCase();
  const status = query.status?.toUpperCase();
  const visibility = query.visibility?.toLowerCase() || 'visible';
  if (severity && !VALID_SEVERITIES.has(severity)) {
    const error = new Error('severity must be WARNING or CRITICAL');
    error.statusCode = 400;
    throw error;
  }
  if (status && !VALID_STATUSES.has(status)) {
    const error = new Error('status must be NEW, ACKNOWLEDGED, or RESOLVED');
    error.statusCode = 400;
    throw error;
  }
  if (!VALID_VISIBILITIES.has(visibility)) {
    const error = new Error('visibility must be visible or dismissed');
    error.statusCode = 400;
    throw error;
  }
  return {
    roomId: query.room_id || 'P.101',
    severity,
    status,
    visibility,
    limit: query.limit,
  };
}

function sendError(res, error) {
  const status = error.statusCode || 500;
  return res.status(status).json({
    success: false,
    message: status >= 500 ? 'Internal server error' : error.message,
  });
}

function createAlertController({ service }) {
  if (!service) throw new TypeError('AlertService is required');

  async function list(req, res) {
    try {
      const alerts = await service.list({ ...parseFilters(req.query), userId: req.user?.id });
      return res.status(200).json({
        success: true,
        total: alerts.length,
        data: alerts.map(serializeAlert),
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  async function summary(req, res) {
    try {
      const data = await service.summary({
        roomId: req.query.room_id || 'P.101',
        userId: req.user?.id,
        visibility: 'visible',
        limit: 500,
      });
      return res.status(200).json({ success: true, data });
    } catch (error) {
      return sendError(res, error);
    }
  }

  function publishVisibility(req, alert, event) {
    req.app.get('realtime')?.publishToRoom(alert.roomId, {
      event,
      data: {
        id: alert.id,
        room_id: alert.roomId,
        user_id: req.user?.id ?? null,
      },
    });
  }

  async function restoreDismissal(req, res) {
    try {
      const actorId = req.user?.id;
      const alert = await service.restoreDismissal(req.params.id, actorId);
      publishVisibility(req, alert, REALTIME_EVENT.ALERT_RESTORED);
      return res.status(200).json({
        success: true,
        message: 'Alert restored',
        data: { id: alert.id, room_id: alert.roomId },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  async function dismissResolved(req, res) {
    try {
      const roomId = req.query.room_id || 'P.101';
      const dismissed = await service.dismissResolved(roomId, req.user?.id);
      req.app.get('realtime')?.publishToRoom(roomId, {
        event: REALTIME_EVENT.ALERT_DISMISSED,
        data: {
          room_id: roomId,
          user_id: req.user?.id ?? null,
          bulk: true,
          dismissed,
        },
      });
      return res.status(200).json({
        success: true,
        message: 'Resolved alerts dismissed',
        data: { room_id: roomId, dismissed },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  async function remove(req, res) {
    try {
      const alert = await service.remove(req.params.id, req.user?.id);
      publishVisibility(req, alert, REALTIME_EVENT.ALERT_DELETED);
      return res.status(200).json({
        success: true,
        message: 'Alert deleted',
        data: { id: alert.id, room_id: alert.roomId },
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  async function updateStatus(req, res, action) {
    try {
      const actorId = req.user?.id ?? null;
      const alert = await service[action](req.params.id, actorId);
      const data = serializeAlert(alert);
      req.app.get('realtime')?.publishToRoom(alert.roomId, {
        event: REALTIME_EVENT.ALERT_UPDATED,
        data,
      });
      return res.status(200).json({
        success: true,
        message: action === 'acknowledge' ? 'Alert acknowledged' : 'Alert resolved',
        data,
      });
    } catch (error) {
      return sendError(res, error);
    }
  }

  return {
    list,
    summary,
    acknowledge: (req, res) => updateStatus(req, res, 'acknowledge'),
    resolve: (req, res) => updateStatus(req, res, 'resolve'),
    restoreDismissal,
    dismissResolved,
    remove,
  };
}

module.exports = { createAlertController, parseFilters, serializeAlert };
