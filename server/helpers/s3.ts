import * as AWS from 'aws-sdk'
import env from 'config/env'
import logger from 'config/logger'
import * as Raven from 'raven'

const s3 = new AWS.S3()

export interface IFtpUploadFeedbackArgs {
  orgId: string
  notificationEndpoint: string
  leaseId: string
}

export interface IFtpUploadArgs {
  feedback: IFtpUploadFeedbackArgs // Needed for notification feedback if FTP upload goes wrong. Since it is probably the users fault
  host: string
  username: string
  password: string
  files: IQueueFile[]
}

export interface IDownloadFileArgs {
  bucket: string
  key: string
}

export interface IQueueFile {
  filename: string
  key?: string
  content?: Buffer
}

export async function downloadFile(args: IDownloadFileArgs): Promise<Buffer> {
  const s3Params: AWS.S3.GetObjectRequest = {
    Bucket: args.bucket,
    Key: args.key
  }

  try {
    let s3Result = {} as any
    if (env.NODE_ENV !== env.Environments.Test) {
      s3Result = await s3.getObject(s3Params).promise()
    }

    return s3Result.Body
  } catch (error) {
    Raven.captureMessage('S3 Failed to download file.', {
      extra: {
        s3Message: error.message,
        s3Params
      }
    } as Raven.CaptureOptions)
  }
}

export async function downloadArrayFromS3AndRemove(s3files: IQueueFile[], bucket: string): Promise<Buffer[]> {
  const hasFiles = s3files && s3files.length > 0

  if (hasFiles) {
    const files = []

    for (const file of s3files) {
      const s3ParamsFile: AWS.S3.GetObjectRequest = {
        Bucket: bucket,
        Key: file.key
      }

      let s3Data = {} as any
      if (env.NODE_ENV !== env.Environments.Test) {
        s3Data = await s3.getObject(s3ParamsFile).promise()
      }

      files.push({
        filename: file.filename,
        content: s3Data.Body
      })

      try {
        if (env.NODE_ENV !== env.Environments.Test) {
          await s3.deleteObject({
            Bucket: bucket,
            Key: file.key
          }).promise()
        }
      } catch (error) {
        logger.warn('Failed to delete file from S3. Ignoring.', {
          errorMessage: error.message,
          bucket,
          attachment: file.key
        })

        Raven.captureMessage('Failed to delete file from S3', {
          errorMessage: error.message,
          bucket,
          attachment: file.key
        } as Raven.CaptureOptions)
      }

      return files
    }
  }
}

export async function removeFile(key: string, bucket: string) {
  logger.info('Removing file from S3', {
    key,
    bucket
  })

  if (key[0] === '/') key = key.substring(1) // S3 doesn't like starting slash

  try {
    if (env.NODE_ENV !== env.Environments.Test) {
      const s3Result = await s3.deleteObject({
        Bucket: bucket,
        Key: key
      }).promise()

      logger.info('Removed file from S3', {
        key,
        bucket,
        s3Result
      })
    }
  } catch (error) {
    logger.warn('Failed to delete file from S3. Ignoring.', {
      errorMessage: error.message,
      bucket,
      key
    })

    Raven.captureMessage('Failed to delete single file from S3', {
      errorMessage: error.message,
      bucket,
      key
    } as Raven.CaptureOptions)
  }
}

export async function removeFolder(folder: string, bucket: string) {
  logger.info('Removing folder from S3', {
    folder,
    bucket
  })

  if (env.NODE_ENV === env.Environments.Test) return

  const listParams: AWS.S3.ListObjectsRequest = {
    Bucket: bucket,
    Prefix: folder
  }

  let folderObjects
  try {
    if (env.NODE_ENV !== env.Environments.Test) {
      folderObjects = await s3.listObjects(listParams).promise()
    }
  } catch (error) {
    logger.warn('Failed to list folder on S3. Not deleting folder.', {
      errorMessage: error.message,
      bucket,
      folder
    })

    Raven.captureMessage('Failed to list folder on S3. Not deleting folder.', {
      errorMessage: error.message,
      bucket,
      folder
    } as Raven.CaptureOptions)

    return // Dont continue
  }

  const deleteParams: AWS.S3.DeleteObjectsRequest = {
    Bucket: bucket,
    Delete: {
      Objects: folderObjects.Contents.map(x => {
        return {
          Key: x.Key
        }
      })
    }
  }

  try {
    if (env.NODE_ENV !== env.Environments.Test) {
      const deletedObjects = await s3.deleteObjects(deleteParams).promise()

      logger.info('Removed folder from S3', deletedObjects)
    }
  } catch (error) {
    logger.warn('Failed to delete file from S3. Ignoring.', {
      errorMessage: error.message,
      bucket,
      folder
    })

    Raven.captureMessage('Failed to delete folder from S3', {
      errorMessage: error.message,
      bucket,
      folder
    } as Raven.CaptureOptions)
  }
}

export async function uploadFileToS3(file: IQueueFile, bucket: string): Promise<string> {
  if (!(file.content instanceof Buffer)) {
    throw new Error('File content must be a buffer')
  }

  const s3Params: AWS.S3.PutObjectRequest = {
    Bucket: bucket,
    Key: file.key,
    Body: file.content
  }

  let s3Data = {} as any
  if (env.NODE_ENV !== env.Environments.Test) {
    s3Data = await s3.upload(s3Params).promise()
  }

  logger.info('Uploaded file to S3', s3Data)

  return s3Data.Key
}

export async function uploadArrayToS3(files: IQueueFile[], bucket: string): Promise<IQueueFile[]> {
  const s3files: IQueueFile[] = []

  for (const file of files) {
    const s3Key = await uploadFileToS3(file, bucket)

    s3files.push({
      filename: file.filename,
      key: s3Key
    })
  }

  return s3files
}
