import { PopularChartProcessingModel } from '../models/popularchart'
import { INumberStringSignature } from '../interfaces/generic'
import { IPopularityMatrixSignature, ISongRankSignature } from '../interfaces/epf'
import logger from 'config/logger'
import { sentryMessage } from '../../config/sentry'

export async function processCombinedPopularityMatrix(combinedPopularityMatrix: IPopularityMatrixSignature, genreIdMap: INumberStringSignature, countryCodeByStorefrontIdMap: INumberStringSignature, songRanks: ISongRankSignature) {
  logger.profile('done saving popularcharts to db')
  logger.info('started saving popularcharts to db')

  for (const pair of Object.keys(combinedPopularityMatrix)) {
    const split: string[] = pair.split('.')
    const storefrontId: number = parseInt(split[0], 10)
    const genreId: number = parseInt(split[1], 10)

    const findOneParams = {
      storefrontId,
      genreId
    }

    let popularChart = await PopularChartProcessingModel.findOne(findOneParams)

    if (!popularChart) {
      popularChart = new PopularChartProcessingModel()

      popularChart.storefrontId = storefrontId
      popularChart.genreId = genreId
      popularChart.topItunesTrackIds = []
      popularChart.countryCode = countryCodeByStorefrontIdMap[storefrontId]
      popularChart.genreName = genreIdMap[genreId]
    }

    popularChart.topItunesTrackIds = combinedPopularityMatrix[pair]

    popularChart.topItunesTrackIds.sort((a, b) => {
      return songRanks[`${storefrontId}.${genreId}.${a}`] - songRanks[`${storefrontId}.${genreId}.${b}`]
    })

    popularChart.markModified('topItunesTrackIds')

    try {
      await popularChart.save()
    } catch (error) {
      console.error(error)

      sentryMessage('error during popular chart saving, skipping it', {
        errorMessage: error.message,
        error
      })
    }
  }

  logger.profile('done saving popularcharts to db')
}
