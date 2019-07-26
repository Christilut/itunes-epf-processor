import { writeJsonSync, existsSync, readFileSync } from 'fs-extra'
import { join } from 'path'
import logger from '../../config/logger'

const STATS_PATH: string = join(__dirname, '..', '..', 'stats.json')

export interface IFeedStats {
  lastImported: Date
}

export function writeStats(): void {
  const stats: IFeedStats = {
    lastImported: new Date()
  }

  writeJsonSync(STATS_PATH, stats)

  logger.info(`wrote stats to ${STATS_PATH}`, {
    stats
  })
}

export function getStats(): IFeedStats {
  if (!existsSync(STATS_PATH)) return null

  const json = JSON.parse(readFileSync(STATS_PATH).toString())

  const stats: IFeedStats = {
    lastImported: new Date(json.lastImported)
  }

  logger.info(`read stats from ${STATS_PATH}`, {
    stats
  })

  return stats
}
