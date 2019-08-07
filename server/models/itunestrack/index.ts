import { prop, Typegoose } from 'typegoose'
import { generateModel } from '../../helpers/typegoose'

export const COLLECTION_ITUNES_TRACK = 'itunestracks'
export const COLLECTION_ITUNES_TRACK_OLD = 'itunestracks_old'
export const COLLECTION_ITUNES_TRACK_PROCESSING = 'itunestracks_processing'

export class ItunesTrack extends Typegoose {
  _id: string

  @prop({
    unique: true,
    index: true,
    required: true
  })
  itunesTrackId: number

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

  @prop()
  rank: number
}

const model = new ItunesTrack().getModelForClass(ItunesTrack)

export const ItunesTrackModel = generateModel<ItunesTrack>(model, COLLECTION_ITUNES_TRACK)
export const ItunesTrackProcessingModel = generateModel<ItunesTrack>(model, COLLECTION_ITUNES_TRACK_PROCESSING)
