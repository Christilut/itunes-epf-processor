import * as gunzip from 'bzip2-maybe'
import { createWriteStream, createReadStream, WriteStream, ReadStream } from 'fs'
import { get } from 'https'
import * as tar from 'tar-stream'
import { IncomingMessage } from 'http'

async function downloadFile(url: string, filePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const file: WriteStream = createWriteStream(filePath)

    get(url, function (res) {
      res.pipe(file)

      file.on('finish', () => {
        file.close()

        resolve()
      })
    })
  })
}

async function getUnzippedFileStream(sourcePath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const extract = tar.extract()

    extract.on('entry', function (header, stream, next) {
      // header is the tar header
      // stream is the content body (might be an empty stream)
      // call next when you are done with this entry

      resolve(stream)

      stream.on('end', () => {
        next() // ready for next entry
      })

      stream.on('error', (err) => reject(err))
    })

    extract.on('error', (err) => reject(err))

    const readStream: ReadStream = createReadStream(sourcePath)

    readStream
      .pipe(gunzip())
      .pipe(extract)
  })
}

async function getUrlStream(url: string): Promise<IncomingMessage> {
  return new Promise((resolve, reject) => {
    get(url, function (response) {
      resolve(response)
    }).on('error', (err) => reject(err))
  })
}

export async function getUrlZipStream(url: string): Promise<ReadStream> {
  return new Promise(async (resolve, reject) => {
    const extract = tar.extract()

    extract.on('entry', function (header, stream, next) {
      resolve(stream)

      stream.on('end', () => {
        next() // ready for next entry
      })

      stream.on('error', (err) => reject(err))
    })

    extract.on('error', (err) => reject(err))

    const urlStream = await getUrlStream(url)

    urlStream
      .pipe(gunzip())
      .pipe(extract)
  })
}
