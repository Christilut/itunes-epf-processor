import { writeJsonSync, existsSync, readFileSync } from 'fs-extra'
import { join } from 'path'
import logger from '../../config/logger'
import env from 'config/env'

let STATS_PATH: string = join(__dirname, '..', '..')

if (env.NODE_ENV === env.Environments.Production) {
  STATS_PATH = join(STATS_PATH, '..') // Because of the dist/ folder
}

STATS_PATH = join(STATS_PATH, 'stats.json')

export interface IFeedStats {
  lastImported: Date
}

export function writeStats(date: Date): void {
  const stats: IFeedStats = {
    lastImported: date
  }

  writeJsonSync(STATS_PATH, stats)

  logger.info(`wrote stats to ${STATS_PATH}`, {
    stats
  })
}

export function getStats(): IFeedStats {
  if (!existsSync(STATS_PATH)) {
    logger.info('no previous stats found')

    return null
  }

  const json = JSON.parse(readFileSync(STATS_PATH).toString())

  const stats: IFeedStats = {
    lastImported: new Date(json.lastImported)
  }

  logger.info(`read stats from ${STATS_PATH}`, {
    stats
  })

  return stats
}
