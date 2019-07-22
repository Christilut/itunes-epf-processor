import { index, prop, Typegoose } from 'typegoose'
import { generateModel } from '../../helpers/typegoose'

export const COLLECTION_POPULARCHARTS = 'popularcharts'
export const COLLECTION_POPULARCHARTS_OLD = 'popularcharts_old'
export const COLLECTION_POPULARCHARTS_PROCESSING = 'popularcharts_processing'

@index({ storefrontId: 1, genreId: 1 }, { unique: true })
@index({ countryCode: 1, genreId: 1 }, { unique: true })
export class PopularChart extends Typegoose {
  _id: string

  @prop()
  createdAt: Date

  @prop()
  updatedAt: Date

  @prop({
    maxlength: 2,
    minlength: 2,
    required: true
  })
  countryCode: string

  @prop({
    index: true,
    required: true
  })
  storefrontId: number

  @prop({
    required: true
  })
  genreName: string

  @prop({
    index: true,
    required: true
  })
  genreId: number

  @prop({
    default: []
  })
  topSongIds: number[]
}

const model = new PopularChart().getModelForClass(PopularChart, {
  schemaOptions: {
    timestamps: true
  }
})

export const PopularChartModel = generateModel<PopularChart>(model, COLLECTION_POPULARCHARTS)
export const PopularChartProcessingModel = generateModel<PopularChart>(model, COLLECTION_POPULARCHARTS_PROCESSING)
