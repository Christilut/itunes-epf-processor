import { writeJsonSync, existsSync, readFileSync } from 'fs-extra'
import { join } from 'path'

const STATS_PATH: string = join(__dirname, '..', '..', 'stats.json')

export interface IFeedStats {
  lastImported: Date
}

export function writeStats(): void {
  const stats: IFeedStats = {
    lastImported: new Date()
  }

  writeJsonSync(STATS_PATH, stats)
}

export function getStats(): IFeedStats {
  if (!existsSync(STATS_PATH)) return null

  const json = JSON.parse(readFileSync(STATS_PATH).toString())

  const stats: IFeedStats = {
    lastImported: new Date(json.lastImported)
  }

  return stats
}
