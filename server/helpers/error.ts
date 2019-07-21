/**
 * @extends Error
 */
export class ExtendableError extends Error {
  status: number
  isPublic: boolean
  isOperational: boolean
  skipReportToSentry: boolean

  constructor(message: string, status: number, isPublic: boolean, skipReportToSentry: boolean = false) {
    // if (env.NODE_ENV === env.Environments.Test) console.log('\t', status, message)
    super(message)
    this.name = this.constructor.name
    this.message = message
    this.status = status
    this.isPublic = isPublic
    this.isOperational = true // This is required since bluebird 4 doesn't append it anymore.
    this.skipReportToSentry = skipReportToSentry

    Object.setPrototypeOf(this, ExtendableError.prototype)

    Error.captureStackTrace(this)
  }
}
