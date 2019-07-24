import { prop, Typegoose } from 'typegoose'
import { generateModel } from '../../helpers/typegoose'

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
  songId: number

  @prop({
    required: true
  })
  title: string

  @prop({
    required: true
  })
  artistName: string

  @prop()
  collectionName: string

  @prop({
    required: true
  })
  viewUrl: string

  @prop()
  originalReleaseDate: Date

  @prop()
  itunesReleaseDate: Date

  @prop()
  durationMs: number

  @prop()
  previewUrl: string
}

const model = new Song().getModelForClass(Song, {
  schemaOptions: {
    timestamps: true
  }
})

export const SongModel = generateModel<Song>(model, COLLECTION_SONGS)
export const SongProcessingModel = generateModel<Song>(model, COLLECTION_SONGS_PROCESSING)
