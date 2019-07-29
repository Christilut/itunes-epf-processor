require('app-module-path').addPath(__dirname + '/..')

import logger from 'config/logger'
import * as mongoose from 'config/mongoose'
import { INumberStringSignature } from './interfaces/generic'
import { processCombinedPopularityMatrix } from './processing/process'
import { getUrlZipStream } from './processing/downloader'
import { getLatestFeedInfo, IFeedInfoObject } from './processing/feedcheck'
import { readEpfGenreByLine, readEpfSongPopularityByLine, readEpfStorefrontByLine, upsertItunesTracks } from './processing/reader'
import { getStats, IFeedStats, writeStats } from './processing/stats'
import { COLLECTION_ITUNES_TRACK_PROCESSING, COLLECTION_ITUNES_TRACK_OLD, ItunesTrackModel, COLLECTION_ITUNES_TRACK } from './models/itunestrack'
import { COLLECTION_POPULARCHARTS_PROCESSING, COLLECTION_POPULARCHARTS_OLD, PopularChartModel, COLLECTION_POPULARCHARTS } from './models/popularchart'
import env from '../config/env'

mongoose.default.connection.once('open', async function () {
  if (!process.argv.includes('--start')) { // This is needed because I'm starting it from the Heroku Scheduler and I want to be sure it's not started accidentally
    logger.info('cancelled process because it was not started with the --start flag')
    return process.exit(0)
  }

  const startTime: Date = new Date()

  logger.info(`starting EPF update process (${env.NODE_ENV})`)

  const lastStats: IFeedStats = await getStats()

  logger.info('stats from last run', lastStats)

  let retrieveFullFeed: boolean = false
  let retrieveIncrementalFeed: boolean = false

  const epfInfo: IFeedInfoObject = await getLatestFeedInfo()

  logger.info('epf info', epfInfo)

  if (!lastStats) retrieveFullFeed = true // Server never ran yet, get full feed
  if (!lastStats && epfInfo.incremental) retrieveIncrementalFeed = true // Server never ran & incremental available, get incremental too

  if (lastStats) {
    if (epfInfo.full.date > lastStats.lastImported) retrieveFullFeed = true
    if (epfInfo.incremental && epfInfo.incremental.date > lastStats.lastImported) retrieveIncrementalFeed = true // Incremental available and its newer than last time we processed
  }

  logger.info('going to retrieve full feed: ' + retrieveFullFeed)
  logger.info('going to retrieve incremental feed: ' + retrieveIncrementalFeed)

  let countryCodeByStorefrontIdMap: INumberStringSignature
  let genreIdMap: INumberStringSignature

  if (retrieveFullFeed || retrieveIncrementalFeed) {
    countryCodeByStorefrontIdMap = await readEpfStorefrontByLine(await getUrlZipStream(`${epfInfo.full.itunesFolderUrl}storefront.tbz`))  // Using full here because these 2 almost never change
    genreIdMap = await readEpfGenreByLine(await getUrlZipStream(`${epfInfo.full.itunesFolderUrl}genre.tbz`))

    // Make sure old unused collections are deleted
    let existingCollections = (await mongoose.default.connection.db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name)

    if (existingCollections.includes(COLLECTION_ITUNES_TRACK_PROCESSING)) await mongoose.default.connection.db.dropCollection(COLLECTION_ITUNES_TRACK_PROCESSING)
    if (existingCollections.includes(COLLECTION_POPULARCHARTS_PROCESSING)) await mongoose.default.connection.db.dropCollection(COLLECTION_POPULARCHARTS_PROCESSING)
    if (existingCollections.includes(COLLECTION_ITUNES_TRACK_OLD)) await mongoose.default.connection.db.dropCollection(COLLECTION_ITUNES_TRACK_OLD)
    if (existingCollections.includes(COLLECTION_POPULARCHARTS_OLD)) await mongoose.default.connection.db.dropCollection(COLLECTION_POPULARCHARTS_OLD)

    existingCollections = (await mongoose.default.connection.db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name)

    if (existingCollections.includes(COLLECTION_ITUNES_TRACK_PROCESSING) || existingCollections.includes(COLLECTION_POPULARCHARTS_PROCESSING)) {
      logger.error('existing collection includes collections that should have been deleted', existingCollections)

      throw new Error('existing collection includes collections that should have been deleted')
    }

    // Now copy live collection to temporary collection to be used during the EPF process
    if (!retrieveFullFeed) { // When retrieving a full feed, we want to start clean so dont copy anything
      await ItunesTrackModel.aggregate([{ $match: {} }, { $out: COLLECTION_ITUNES_TRACK_PROCESSING }])
      await PopularChartModel.aggregate([{ $match: {} }, { $out: COLLECTION_POPULARCHARTS_PROCESSING }])

      await mongoose.default.connection.db.createIndex(COLLECTION_ITUNES_TRACK_PROCESSING, { itunesTrackId: 1 }, { unique: true })
      await mongoose.default.connection.db.createIndex(COLLECTION_POPULARCHARTS_PROCESSING, { storefrontId: 1, genreId: 1 }, { unique: true })

      logger.info('done copying collections to temporary collections')
    }
  } else {
    logger.info('no new feeds found')
  }

  if (retrieveFullFeed) {
    logger.profile('done retrieving full feed')
    logger.info('started retrieving full feed')

    const { combinedPopularityMatrix, savedItunesTrackIds: savedItunesTrackIds } = await readEpfSongPopularityByLine(await getUrlZipStream(`${epfInfo.full.popularityFolderUrl}song_popularity_per_genre.tbz`))

    await processCombinedPopularityMatrix(combinedPopularityMatrix, genreIdMap, countryCodeByStorefrontIdMap)

    await upsertItunesTracks(savedItunesTrackIds, await getUrlZipStream(`${epfInfo.full.itunesFolderUrl}song.tbz`), true)

    logger.profile('done retrieving full feed')
  }

  if (retrieveIncrementalFeed) {
    logger.profile('done processing incremental feed')
    logger.info('started processing incremental feed')

    const { combinedPopularityMatrix, savedItunesTrackIds: savedItunesTrackIds } = await readEpfSongPopularityByLine(await getUrlZipStream(`${epfInfo.incremental.popularityFolderUrl}song_popularity_per_genre.tbz`))

    await processCombinedPopularityMatrix(combinedPopularityMatrix, genreIdMap, countryCodeByStorefrontIdMap)

    await upsertItunesTracks(savedItunesTrackIds, await getUrlZipStream(`${epfInfo.incremental.itunesFolderUrl}song.tbz`), false)

    logger.profile('done processing incremental feed')
  }

  if (retrieveFullFeed || retrieveIncrementalFeed) {
    await writeStats(startTime)

    // Swap collection names and delete old collection
    await mongoose.default.connection.db.renameCollection(COLLECTION_ITUNES_TRACK, COLLECTION_ITUNES_TRACK_OLD)
    await mongoose.default.connection.db.renameCollection(COLLECTION_ITUNES_TRACK_PROCESSING, COLLECTION_ITUNES_TRACK)
    await mongoose.default.connection.db.dropCollection(COLLECTION_ITUNES_TRACK_OLD)

    await mongoose.default.connection.db.renameCollection(COLLECTION_POPULARCHARTS, COLLECTION_POPULARCHARTS_OLD)
    await mongoose.default.connection.db.renameCollection(COLLECTION_POPULARCHARTS_PROCESSING, COLLECTION_POPULARCHARTS)
    await mongoose.default.connection.db.dropCollection(COLLECTION_POPULARCHARTS_OLD)
  }

  logger.info('EPF update process complete')

  logger.exit()

  process.exit(0)
})
