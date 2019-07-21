import env from '../../config/env'
import axios from 'axios'
import * as cheerio from 'cheerio'
import * as moment from 'moment'

const AUTH_ENCODED: string = Buffer.from(`${env.EPF_USERNAME}:${env.EPF_PASSWORD}`).toString('base64')
const BASE_URL: string = `https://${encodeURIComponent(env.EPF_USERNAME)}:${encodeURIComponent(env.EPF_PASSWORD)}@feeds.itunes.apple.com`
const EPF_ROOT_DIR: string = `${BASE_URL}/feeds/epf/v4/current/current`

interface IFeedInfo {
  itunesFolderName: string
  popularityFolderName: string
  date: Date
  itunesFolderUrl: string
  popularityFolderUrl: string
}

export interface IFeedInfoObject {
  full: IFeedInfo
  incremental: IFeedInfo
}

async function downloadPage(url: string): Promise<string> {
  const { data } = await axios({
    url,
    method: 'GET',
    headers: {
      authorization: `Basic ${AUTH_ENCODED}`
    }
  })

  return data
}

function getLatestFullFeedInfo(page: string): IFeedInfo {
  let feedInfo: IFeedInfo = null

  const $ = cheerio.load(page)

  const link = $('tr > td > a').filter(function () {
    return $(this).text().indexOf('itunes') === 0
  })

  if (link.length === 1) {
    const folderName: string = link.text()
    const dateString: string = folderName.replace('itunes', '').replace('/', '')

    const date: Date = moment(dateString, 'YYYYMMDD').toDate()

    const itunesFolderName: string = folderName
    const popularityFolderName: string = folderName.replace('itunes', 'popularity')

    feedInfo = {
      itunesFolderName,
      popularityFolderName,
      date,
      itunesFolderUrl: `${EPF_ROOT_DIR}/${itunesFolderName}`,
      popularityFolderUrl: `${EPF_ROOT_DIR}/${popularityFolderName}`
    }
  } else {
    throw new Error('itunes full feed link not found')
  }

  return feedInfo
}

async function getLatestIncrementalFeedInfo(page): Promise<IFeedInfo> {
  let feedInfo: IFeedInfo = null

  let $ = cheerio.load(page)

  let link = $('tr > td > a').filter(function () {
    return $(this).text().indexOf('incremental') === 0
  })

  if (link.length === 1) {
    const incrementalFolderUrl: string = `${EPF_ROOT_DIR}/incremental/current`
    const incrementalPage: string = await downloadPage(incrementalFolderUrl)

    $ = cheerio.load(incrementalPage)

    link = $('tr > td > a').filter(function () {
      return $(this).text().indexOf('itunes') === 0
    })

    const folderName: string = link.text()
    const dateString: string = folderName.replace('itunes', '').replace('/', '')

    const date: Date = moment(dateString, 'YYYYMMDD').toDate()

    const itunesFolderName: string = folderName
    const popularityFolderName: string = folderName.replace('itunes', 'popularity')

    feedInfo = {
      itunesFolderName,
      popularityFolderName,
      date,
      itunesFolderUrl: `${EPF_ROOT_DIR}/incremental/current/${itunesFolderName}`,
      popularityFolderUrl: `${EPF_ROOT_DIR}/incremental/current/${popularityFolderName}`
    }
  } else {
    // No incremental feed found now
  }

  return feedInfo
}

export async function getLatestFeedInfo(): Promise<IFeedInfoObject> {
  const rootPage: string = await downloadPage(EPF_ROOT_DIR)

  const fullFeedInfo: IFeedInfo = getLatestFullFeedInfo(rootPage)

  const incrementalFeedInfo: IFeedInfo = await getLatestIncrementalFeedInfo(rootPage)

  return {
    full: fullFeedInfo,
    incremental: incrementalFeedInfo
  }
}
