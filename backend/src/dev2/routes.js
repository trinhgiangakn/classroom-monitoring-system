export function createDev2Router({ Router, authenticate, afterAuthenticate, controller }) {
  if (typeof Router !== 'function') throw new TypeError('Express Router factory is required')
  if (typeof authenticate !== 'function') throw new TypeError('Dev 1 authenticate middleware is required')
  if (!controller) throw new TypeError('controller is required')

  const router = Router()
  router.use(authenticate)
  if (afterAuthenticate !== undefined) {
    if (typeof afterAuthenticate !== 'function') throw new TypeError('afterAuthenticate must be middleware')
    router.use(afterAuthenticate)
  }
  router.get('/sensors/latest', controller.latest)
  router.get('/sensors/history', controller.history)
  router.get('/sensors/recent', controller.recent)
  router.get('/sensors/export', controller.exportCsv)
  router.get('/nodes', controller.nodes)
  router.get('/nodes/:id', controller.node)
  router.get('/gateway/status', controller.gatewayStatus)
  return router
}
