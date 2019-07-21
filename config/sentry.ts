import env from 'config/env'
import * as Raven from 'raven'
import logger from 'config/logger'

function dataCallback(data) {
  logger.error('Sentry error: ' + data.message, {
    message: data.message,
    extra: data.extra,
    serverName: data.server_name,
    eventId: data.event_id
  })

  return data
}

Raven.config(env.SENTRY_URL, {
  environment: env.NODE_ENV,
  dataCallback
}).install()

if (env.SENTRY_URL) {
  console.log('Sentry:\t\t\tLoaded')
} else {
  console.log('Sentry:\t\t\tMissing Sentry credentials, not loading')
}
