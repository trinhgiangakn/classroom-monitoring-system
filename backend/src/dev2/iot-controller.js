export class IotController {
  constructor(service) {
    this.service = service
    this.latest = this.latest.bind(this)
    this.history = this.history.bind(this)
    this.recent = this.recent.bind(this)
    this.exportCsv = this.exportCsv.bind(this)
    this.nodes = this.nodes.bind(this)
    this.node = this.node.bind(this)
    this.gatewayStatus = this.gatewayStatus.bind(this)
  }

  async latest(request, response, next) {
    try {
      response.status(200).json(await this.service.latest(request.query))
    } catch (error) {
      next(error)
    }
  }

  async history(request, response, next) {
    try {
      response.status(200).json(await this.service.history(request.query))
    } catch (error) {
      next(error)
    }
  }

  async recent(request, response, next) {
    try {
      response.status(200).json(await this.service.recent(request.query))
    } catch (error) {
      next(error)
    }
  }

  async exportCsv(request, response, next) {
    try {
      const result = await this.service.exportCsv(request.query)
      response.status(200)
      response.setHeader('Content-Type', 'text/csv; charset=utf-8')
      response.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`)
      response.send(result.content)
    } catch (error) {
      next(error)
    }
  }

  async nodes(request, response, next) {
    try {
      response.status(200).json(await this.service.nodes(request.query))
    } catch (error) {
      next(error)
    }
  }

  async node(request, response, next) {
    try {
      response.status(200).json(await this.service.node(request.query.room_id, request.params.id))
    } catch (error) {
      next(error)
    }
  }

  async gatewayStatus(request, response, next) {
    try {
      response.status(200).json(await this.service.gatewayStatus(request.query))
    } catch (error) {
      next(error)
    }
  }
}
