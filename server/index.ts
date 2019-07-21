require('app-module-path').addPath(__dirname + '/..')

import 'config/logger'
import 'config/sentry'
import 'config/mongoose'
import 'server/models'

// TODO: just start process here
