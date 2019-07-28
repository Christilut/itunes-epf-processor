import { ItunesTrackProcessingModel, ItunesTrack } from '../models/itunestrack'
import * as lineReader from 'line-reader'
import { promisify } from 'util'
import { ReadStream } from 'fs'
import { InstanceType } from 'typegoose'
import { INumberStringSignature, IStringStringSignature } from '../interfaces/generic'
import { IPopularityMatrixSignature } from '../interfaces/epf'
import * as Moment from 'moment'
import logger from 'config/logger'
const countryCodesByIso2 = require('../../countryCodes.json')

const eachLine = promisify(lineReader.eachLine)

const TOP_AMOUNT = 100

const ALLOWED_GENRE_MAP: { [key: number]: number } = { // The left side will be mapped to the right side. Leave the same if the original genre is good.
  2: 2, // Blues
  6: 6, // Country
  7: 7, // Electronic
  11: 11, // Jazz
  12: 12, // Latin
  14: 14, // Pop
  15: 15, // R&B/Soul
  17: 17, // Dance
  18: 18, // Hiphop/Rap
  19: 19, // World
  20: 20, // Alternative
  21: 21, // Rock
  24: 24, // Reggea
  25: 25, // Easy Listening
  1044: 1044, // Breakbeat  // These are dance subgenres (techno, dnb, etc) that will have their own genre object
  1047: 1047, // Hardcore
  1050: 1050, // Techno
  1051: 1051, // Trance
  1046: 1046, // Garage
  1048: 1048, // House
  1049: 1049 // Jungle/Drum & Bass
}

export async function upsertItunesTracks(savedItunesTrackIds: Set<number>, stream: ReadStream, insertOnly: boolean): Promise<void> {
  logger.profile('done adding itunes tracks to db')
  logger.info('started adding itunes tracks to db')

  let scannedAmount: number = 0

  await eachLine(stream, async function (line: string, last: boolean, callback: Function) {
    if (line.indexOf('#') === 0) return callback(true) // Next line

    line = line.replace('\u0002', '')

    const row: string[] = line.split('')

    if (row.length < 12) { // It can be 12 or 14, depending if a song has a preview. Weird records have very little info and we skip them
      return callback(true) // Next line
    }

    const itunesTrackId: number = parseInt(row[1].toString(), 10)

    if (savedItunesTrackIds.has(itunesTrackId)) {
      let itunesTrack: InstanceType<ItunesTrack>

      if (insertOnly) { // With full feed we only want to add, no need to slow the process down with lookups
        itunesTrack = new ItunesTrackProcessingModel()
      } else {
        itunesTrack = await ItunesTrackProcessingModel.findOne({ itunesTrackId: itunesTrackId })

        if (!itunesTrack) {
          itunesTrack = new ItunesTrackProcessingModel()
        }
      }

      itunesTrack.itunesTrackId = itunesTrackId
      itunesTrack.title = row[2].toString()
      itunesTrack.artistName = row[6].toString()
      itunesTrack.collectionName = row[7].toString()
      itunesTrack.viewUrl = row[8].toString()
      itunesTrack.originalReleaseDate = Moment(row[9].toString(), 'YYYY MM DD').toDate()
      itunesTrack.itunesReleaseDate = Moment(row[10].toString(), 'YYYY MM DD').toDate()
      itunesTrack.durationMs = parseInt(row[11].toString(), 10)

      if (row[14]) {
        itunesTrack.previewUrl = row[14].toString()
      }

      await itunesTrack.save()
    }

    scannedAmount++

    if (scannedAmount % 1000000 === 0) {
      logger.info(`scanned ${scannedAmount} tracks so far`)
    }

    callback(!last) // End if last or next line
  })

  logger.profile('done adding itunes tracks to db')
}

export async function readEpfGenreByLine(stream: ReadStream): Promise<INumberStringSignature> {
  logger.profile('done saving genres to memory')
  logger.info('started saving genres to memory')

  const genreIdMap: INumberStringSignature = {}

  await eachLine(stream, async function (line: string, last: boolean, callback: Function) {
    if (line.indexOf('#') === 0) return callback(true) // Go to next line

    line = line.replace('\u0002', '')

    const row: string[] = line.split('')

    const genreId: number = parseInt(row[1].toString(), 10)
    const name: string = row[3].toString()

    genreIdMap[genreId] = name

    callback(!last) // Go to next line
  })

  logger.profile('done saving genres to memory')

  return genreIdMap
}

export async function readEpfSongPopularityByLine(stream: ReadStream): Promise<{ combinedPopularityMatrix: IPopularityMatrixSignature, savedItunesTrackIds: Set<number> }> {
  logger.profile('done processing popularity')
  logger.info('started processing popularity')

  const combinedPopularityMatrix: IPopularityMatrixSignature = {}
  const savedItunesTrackIds: Set<number> = new Set([])

  await eachLine(stream, async function (line: string, last: boolean, callback: Function) {
    if (line.indexOf('#') === 0) return callback(true) // Go to next line

    line = line.replace('\u0002', '')

    const row: string[] = line.split('')

    const storefrontId: number = parseInt(row[1].toString(), 10)
    const genreId: number = parseInt(row[2].toString(), 10)
    const itunesTrackId: number = parseInt(row[3].toString(), 10)

    const allowedGenreId: number = ALLOWED_GENRE_MAP[genreId]

    if (allowedGenreId) {
      const id: string = `${storefrontId}.${allowedGenreId}`

      if (!combinedPopularityMatrix[id]) {
        combinedPopularityMatrix[id] = []
      }

      if (combinedPopularityMatrix[id].length < TOP_AMOUNT) {
        combinedPopularityMatrix[id].push(itunesTrackId)
      }

      savedItunesTrackIds.add(itunesTrackId)
    }

    callback(!last)
  })

  logger.profile('done processing popularity')

  return {
    combinedPopularityMatrix,
    savedItunesTrackIds
  }
}

export async function readEpfStorefrontByLine(stream: ReadStream): Promise<INumberStringSignature> {
  logger.profile('done reading storefronts into memory')
  logger.info('started reading storefronts into memory')

  const countryCodeByStorefrontIdMap: INumberStringSignature = {}
  const countryCodesByIso3Map: IStringStringSignature = {}

  for (const code in countryCodesByIso2) {
    countryCodesByIso3Map[countryCodesByIso2[code]] = code
  }

  await eachLine(stream, async function (line: string, last: boolean, callback: Function) {
    if (line.indexOf('#') === 0) return callback(true) // Go to next line

    line = line.replace('\u0002', '')

    const row: string[] = line.split('')

    const storefrontId: number = parseInt(row[1].toString(), 10)
    const countryCodeIso3: string = row[2].toString()
    const countryCodeIso2: string = countryCodesByIso3Map[countryCodeIso3]

    if (!countryCodeIso2) {
      logger.info(`Country code ISO3 value "${countryCodeIso3}" had no ISO2 match`)
    }

    countryCodeByStorefrontIdMap[storefrontId] = countryCodeIso2

    callback(!last)
  })

  logger.profile('done reading storefronts into memory')

  return countryCodeByStorefrontIdMap
}
