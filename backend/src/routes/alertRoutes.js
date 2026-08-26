const express = require('express');
const { createAlertController } = require('../controllers/alertController');

function createAlertRouter({ service, authenticate, requireAdmin, requireTechOrAdmin }) {
  const router = express.Router();
  const controller = createAlertController({ service });

  const techOrAdmin = requireTechOrAdmin || ((req, res, next) => next());

  router.use(authenticate);
  router.get('/', controller.list);
  router.get('/summary', controller.summary);
  router.put('/dismiss-resolved', controller.dismissResolved);
  router.put('/:id/acknowledge', techOrAdmin, controller.acknowledge);
  router.put('/:id/resolve', techOrAdmin, controller.resolve);
  router.delete('/:id/dismiss', controller.restoreDismissal);
  router.delete('/:id', requireAdmin, controller.remove);

  return router;
}

module.exports = { createAlertRouter };
