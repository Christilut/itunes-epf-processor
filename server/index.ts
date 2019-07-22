require('app-module-path').addPath(__dirname + '/..')

import logger from 'config/logger'
import * as mongoose from 'config/mongoose'
import 'config/sentry'
import { COLLECTION_POPULARCHARTS, COLLECTION_POPULARCHARTS_OLD, COLLECTION_POPULARCHARTS_PROCESSING, COLLECTION_SONGS, COLLECTION_SONGS_OLD, COLLECTION_SONGS_PROCESSING, PopularChartModel, PopularChartProcessingModel, SongModel, SongProcessingModel } from 'server/models'
import { getUrlZipStream } from './processing/downloader'
import { getLatestFeedInfo, IFeedInfoObject } from './processing/feedcheck'
import { readEpfGenreByLine, readEpfSongPopularityByLine, readEpfStorefrontByLine, upsertSongs } from './processing/reader'
import { getStats, IFeedStats, writeStats } from './processing/stats'
import { processCombinedPopularityMatrix } from './processing/database'
import { INumberStringSignature } from './interfaces/generic'

mongoose.default.connection.once('open', async function () {
  logger.info('starting EPF update process')

  const lastStats: IFeedStats = getStats()

  let retrieveFullFeed: boolean = false
  let retrieveIncrementalFeed: boolean = false

  const epfInfo: IFeedInfoObject = await getLatestFeedInfo()

  logger.info(epfInfo)

  if (!lastStats) retrieveFullFeed = true // Server never ran yet, get full feed
  if (!lastStats && epfInfo.incremental) retrieveIncrementalFeed = true // Server never ran & incremental available, get incremental too

  if (lastStats) {
    if (epfInfo.full.date > lastStats.lastImported) retrieveFullFeed = true
    if (epfInfo.incremental && epfInfo.incremental.date > lastStats.lastImported) retrieveIncrementalFeed = true // Incremental available and its newer than last time we processed
  }

  logger.info('going to retrieve full feed:', retrieveFullFeed)
  logger.info('going to retrieve incremental feed:', retrieveIncrementalFeed)

  let countryCodeByStorefrontIdMap: INumberStringSignature
  let genreIdMap: INumberStringSignature

  if (retrieveFullFeed || retrieveIncrementalFeed) {
    countryCodeByStorefrontIdMap = await readEpfStorefrontByLine(await getUrlZipStream(`${epfInfo.full.itunesFolderUrl}storefront.tbz`))  // Using full here because these 2 almost never change
    genreIdMap = await readEpfGenreByLine(await getUrlZipStream(`${epfInfo.full.itunesFolderUrl}genre.tbz`))

    // Make sure old unused collections are deleted
    const existingCollections = (await mongoose.default.connection.db.listCollections({}, { nameOnly: true }).toArray()).map(x => x.name)

    if (existingCollections.includes(COLLECTION_SONGS_PROCESSING)) await mongoose.default.connection.db.dropCollection(COLLECTION_SONGS_PROCESSING)
    if (existingCollections.includes(COLLECTION_POPULARCHARTS_PROCESSING)) await mongoose.default.connection.db.dropCollection(COLLECTION_POPULARCHARTS_PROCESSING)
    if (existingCollections.includes(COLLECTION_SONGS_OLD)) await mongoose.default.connection.db.dropCollection(COLLECTION_SONGS_OLD)
    if (existingCollections.includes(COLLECTION_POPULARCHARTS_OLD)) await mongoose.default.connection.db.dropCollection(COLLECTION_POPULARCHARTS_OLD)

    // Now copy live collection to temporary collection to be used during the EPF process
    await SongModel.aggregate([{ $match: {} }, { $out: COLLECTION_SONGS_PROCESSING }])
    await PopularChartModel.aggregate([{ $match: {} }, { $out: COLLECTION_POPULARCHARTS_PROCESSING }])

    await SongProcessingModel.collection.createIndex({ songId: 1 }, { unique: true })
    await PopularChartProcessingModel.collection.createIndex({ storefrontId: 1, genreId: 1 }, { unique: true })

    logger.info('done copying collections to temporary collections')
  } else {
    logger.info('no new feeds found')
  }

  if (retrieveFullFeed) {
    logger.profile('done retrieving full feed')
    logger.info('started retrieving full feed')

    const { combinedPopularityMatrix, savedSongIds } = await readEpfSongPopularityByLine(await getUrlZipStream(`${epfInfo.full.popularityFolderUrl}song_popularity_per_genre.tbz`))

    await processCombinedPopularityMatrix(combinedPopularityMatrix, genreIdMap, countryCodeByStorefrontIdMap)

    await upsertSongs(savedSongIds, await getUrlZipStream(`${epfInfo.full.itunesFolderUrl}song.tbz`), true)

    writeStats()

    logger.profile('done retrieving full feed')
  }

  if (retrieveIncrementalFeed) {
    logger.profile('done processing incremental feed')
    logger.info('started processing incremental feed')

    const { combinedPopularityMatrix, savedSongIds } = await readEpfSongPopularityByLine(await getUrlZipStream(`${epfInfo.incremental.popularityFolderUrl}song_popularity_per_genre.tbz`))

    await processCombinedPopularityMatrix(combinedPopularityMatrix, genreIdMap, countryCodeByStorefrontIdMap)

    await upsertSongs(savedSongIds, await getUrlZipStream(`${epfInfo.incremental.itunesFolderUrl}song.tbz`), false)

    writeStats()

    logger.profile('done processing incremental feed')
  }

  if (retrieveFullFeed || retrieveIncrementalFeed) {
    // Swap collection names and delete old collection
    await mongoose.default.connection.db.renameCollection(COLLECTION_SONGS, COLLECTION_SONGS_OLD)
    await mongoose.default.connection.db.renameCollection(COLLECTION_SONGS_PROCESSING, COLLECTION_SONGS)
    await mongoose.default.connection.db.dropCollection(COLLECTION_SONGS_OLD)

    await mongoose.default.connection.db.renameCollection(COLLECTION_POPULARCHARTS, COLLECTION_POPULARCHARTS_OLD)
    await mongoose.default.connection.db.renameCollection(COLLECTION_POPULARCHARTS_PROCESSING, COLLECTION_POPULARCHARTS)
    await mongoose.default.connection.db.dropCollection(COLLECTION_POPULARCHARTS_OLD)
  }

  logger.info('EPF update process complete')

  // process.exit(0)
})
