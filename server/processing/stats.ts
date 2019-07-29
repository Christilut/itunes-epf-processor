import { writeJsonSync, existsSync, readFileSync } from 'fs-extra'
import { join } from 'path'
import logger from '../../config/logger'
import env from 'config/env'
import { uploadFileToS3, downloadFile as downloadFileFromS3 } from '../helpers/s3'

const STATS_FILENAME: string = 'stats.json'
const BUCKET: string = 'itunes-epf-processor'
const STATS_PATH_DEVELOPMENT: string = join(__dirname, '..', '..', STATS_FILENAME)

export interface IFeedStats {
  lastImported: Date
}

export async function writeStats(date: Date): Promise<void> {
  const stats: IFeedStats = {
    lastImported: date
  }

  if (env.NODE_ENV === env.Environments.Production) {
    await uploadFileToS3({
      content: Buffer.from(JSON.stringify(stats)),
      filename: null, // Not used
      key: STATS_FILENAME
    }, BUCKET)

    logger.info(`wrote stats to s3`, {
      bucket: BUCKET,
      key: STATS_FILENAME,
      stats
    })
  } else {
    writeJsonSync(STATS_PATH_DEVELOPMENT, stats)

    logger.info(`wrote stats to ${STATS_PATH_DEVELOPMENT}`, {
      stats
    })
  }
}

export async function getStats(): Promise<IFeedStats> {
  let json: IFeedStats

  if (env.NODE_ENV === env.Environments.Production) {
    const buffer = await downloadFileFromS3({
      bucket: BUCKET,
      key: STATS_FILENAME
    })

    if (!buffer) return null

    json = JSON.parse(buffer.toString())
  } else {
    if (!existsSync(STATS_PATH_DEVELOPMENT)) {
      logger.info('no previous stats found')

      return null
    }

    json = JSON.parse(readFileSync(STATS_PATH_DEVELOPMENT).toString())

    logger.info(`read stats from ${STATS_PATH_DEVELOPMENT}`, {
      json
    })
  }

  const stats: IFeedStats = {
    lastImported: new Date(json.lastImported)
  }

  return stats
}
