import { PopularChartProcessingModel } from '../models'
import { INumberStringSignature } from '../interfaces/generic'
import { IPopularityMatrixSignature } from '../interfaces/epf'

export async function processCombinedPopularityMatrix(combinedPopularityMatrix: IPopularityMatrixSignature, genreIdMap: INumberStringSignature, countryCodeByStorefrontIdMap: INumberStringSignature) {
  console.time('done saving popularcharts to db')
  console.log('started saving popularcharts to db')

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
      popularChart.topSongIds = []
      popularChart.countryCode = countryCodeByStorefrontIdMap[storefrontId]
      popularChart.genreName = genreIdMap[genreId]
    }

    popularChart.topSongIds = combinedPopularityMatrix[pair]

    popularChart.markModified('topSongIds')

    await popularChart.save()
  }

  console.timeEnd('done saving popularcharts to db')
}
