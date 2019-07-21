import env from 'config/env'
import * as mongoose from 'mongoose'
import { prop, arrayProp, Typegoose, InstanceType, staticMethod, instanceMethod, pre } from 'typegoose'

export const COLLECTION_SONGS = 'songs'
export const COLLECTION_SONGS_OLD = 'songs_old'
export const COLLECTION_SONGS_PROCESSING = 'songs_processing'

export class Song extends Typegoose {
  _id: string

  @prop()
  createdAt: Date

  @prop()
  updatedAt: Date

  @prop({
    unique: true,
    index: true,
    required: true
  })
  songId: Number

  @prop({
    required: true
  })
  title: String

  @prop({
    required: true
  })
  artistName: String

  @prop()
  collectionName: String

  @prop({
    required: true
  })
  viewUrl: String

  @prop()
  durationMs: Number

  @prop()
  previewUrl: String

  @prop()
  previewDurationMs: Number
}

export const SongModel = new Song().getModelForClass(Song, {
  schemaOptions: {
    timestamps: true,
    collection: COLLECTION_SONGS
  }
})

export const SongProcessingModel = new Song().getModelForClass(COLLECTION_SONGS_PROCESSING, {
  schemaOptions: {
    timestamps: true,
    collection: COLLECTION_SONGS_PROCESSING
  }
})
