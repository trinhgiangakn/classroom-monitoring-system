/**
 * Integration adapter: DEV 2 calls this class after persistence; it loads the
 * database-backed context/rules then delegates all rule decisions to the pure
 * AutomationService domain module.
 */
class AutomationRuntime {
  constructor({ automationService, repository, weatherContext = null, logger = console }) {
    this.automationService = automationService;
    this.repository = repository;
    this.weatherContext = weatherContext;
    this.logger = logger;
  }

  async handleTelemetry({ roomId, telemetry }) {
    const [context, rules] = await Promise.all([
      this.repository.getRuntimeContext(roomId),
      this.repository.listEnabledRules(roomId),
    ]);
    let weather;
    if (this.weatherContext) {
      try {
        weather = await this.weatherContext.getFreshLatest(roomId);
      } catch (error) {
        this.logger.warn(`Weather context unavailable for ${roomId}: ${error.message}`);
      }
    }
    const results = [];
    for (const rule of rules) {
      const result = await this.automationService.handleTelemetry({
        roomId,
        operationMode: context.operationMode,
        rule,
        telemetry,
        validNodeCount: context.validNodeCount,
        weather,
      });
      if (result) results.push(result);
    }
    return results;
  }

  handleNodeStatuses({ roomId, statuses }) {
    return this.automationService.handleNodeStatuses(roomId, statuses);
  }

  handleGatewayStatus({ roomId, gatewayStatus }) {
    return this.automationService.handleGatewayStatus(roomId, gatewayStatus);
  }
}


module.exports = { AutomationRuntime };
