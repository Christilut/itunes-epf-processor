import { ItunesTrackProcessingModel, ItunesTrack } from '../models/itunestrack'
import * as lineReader from 'line-reader'
import { promisify } from 'util'
import { ReadStream } from 'fs'
import { InstanceType } from 'typegoose'
import { INumberStringSignature, IStringStringSignature } from '../interfaces/generic'
import { IPopularityMatrixSignature, ISongRankSignature } from '../interfaces/epf'
import * as Moment from 'moment'
import logger from 'config/logger'
const countryCodesByIso2 = require('../../countryCodes.json')

const eachLine = promisify(lineReader.eachLine)

const TOP_AMOUNT = 100

const ALLOWED_GENREIDS: number[] = [
  // These genres are properly filled on itunes:
  6, // Country
  7, // Electronic
  12, // Latin
  14, // Pop
  15, // R&B/Soul
  17, // Dance
  18, // Hiphop/Rap
  20, // Alternative
  21 // Rock

  // These have very few songs and/or are very outdated
  // 1048: 1048 // House
  // 2: 2, // Blues
  // 19: 19, // World
  // 24: 24, // Reggea
  // 11: 11, // Jazz
  // 25: 25, // Easy Listening
  // 1044: 1044, // Breakbeat  // These are dance subgenres (techno, dnb, etc) that will have their own genre object
  // 1047: 1047, // Hardcore
  // 1050: 1050, // Techno
  // 1051: 1051, // Trance
  // 1046: 1046, // Garage
  // 1049: 1049 // Jungle/Drum & Bass
]

const ALLOWED_STOREFRONTIDS: number[] = [
  143460, // Australia
  143445, // Austria
  143446, // Belgium
  143503, // Brasil
  143455, // Canada
  143489, // Czech Republic
  143458, // Denmark
  143447, // Finland
  143442, // France
  143443, // Germany
  143448, // Greece
  143463, // Hong Kong
  143467, // India
  143476, // Indonesia
  143449, // Ireland
  143491, // Israel
  143450, // Italy
  143462, // Japan
  143468, // Mexico
  143452, // Netherlands
  143461, // New Zealand
  143457, // Norway
  143474, // Philippines
  143478, // Poland
  143453, // Portugal
  143469, // Russia
  143472, // South Africa
  143454, // Spain
  143456, // Sweden
  143459, // Switzerland
  143475, // Thailand
  143480, // Turkey
  143471, // Vietnam
  143444, // UK
  143492, // Ukraine
  143441 // US
]

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

export async function readEpfSongPopularityByLine(stream: ReadStream): Promise<{ combinedPopularityMatrix: IPopularityMatrixSignature, savedItunesTrackIds: Set<number>, songRanks: ISongRankSignature }> {
  logger.profile('done processing popularity')
  logger.info('started processing popularity')

  const combinedPopularityMatrix: IPopularityMatrixSignature = {}
  const savedItunesTrackIds: Set<number> = new Set([])
  const songRanks: ISongRankSignature = {}

  await eachLine(stream, async function (line: string, last: boolean, callback: Function) {
    if (line.indexOf('#') === 0) return callback(true) // Go to next line

    line = line.replace('\u0002', '')

    const row: string[] = line.split('')

    const storefrontId: number = parseInt(row[1].toString(), 10)
    const genreId: number = parseInt(row[2].toString(), 10)
    const itunesTrackId: number = parseInt(row[3].toString(), 10)
    const rank: number = parseInt(row[4].toString(), 10)

    const isGenreAllowed: boolean = ALLOWED_GENREIDS.includes(genreId)
    const isStorefrontAllowed: boolean = ALLOWED_STOREFRONTIDS.includes(storefrontId)

    if (isGenreAllowed && isStorefrontAllowed) {
      const id: string = `${storefrontId}.${genreId}`

      if (!combinedPopularityMatrix[id]) {
        combinedPopularityMatrix[id] = []
      }

      if (combinedPopularityMatrix[id].length < TOP_AMOUNT) {
        combinedPopularityMatrix[id].push(itunesTrackId)
      }

      savedItunesTrackIds.add(itunesTrackId)

      songRanks[`${storefrontId}.${genreId}.${itunesTrackId}`] = rank
    }

    callback(!last)
  })

  logger.profile('done processing popularity')

  return {
    combinedPopularityMatrix,
    savedItunesTrackIds,
    songRanks
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
