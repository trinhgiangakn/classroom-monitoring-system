export class Dev2Error extends Error {
  constructor(message, { code = 'DEV2_ERROR', status = 500, details } = {}) {
    super(message)
    this.name = 'Dev2Error'
    this.code = code
    this.status = status
    this.details = details
  }
}

export class ValidationError extends Dev2Error {
  constructor(message, details) {
    super(message, { code: 'VALIDATION_ERROR', status: 400, details })
    this.name = 'ValidationError'
  }
}

export class NotFoundError extends Dev2Error {
  constructor(message, details) {
    super(message, { code: 'NOT_FOUND', status: 404, details })
    this.name = 'NotFoundError'
  }
}

export function toErrorResponse(error) {
  const known = error instanceof Dev2Error
  const body = {
    success: false,
    error: {
      code: known ? error.code : 'INTERNAL_SERVER_ERROR',
      message: known ? error.message : 'Internal server error',
    },
  }

  if (known && error.details !== undefined) {
    body.error.details = error.details
  }

  return {
    status: known ? error.status : 500,
    body,
  }
}
