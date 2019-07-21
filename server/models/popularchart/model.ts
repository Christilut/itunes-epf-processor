import env from 'config/env'
import * as mongoose from 'mongoose'
import { prop, arrayProp, Typegoose, InstanceType, staticMethod, instanceMethod, pre, index } from 'typegoose'

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
  countryCode: String

  @prop({
    index: true,
    required: true
  })
  storefrontId: Number

  @prop({
    required: true
  })
  genreName: String

  @prop({
    index: true,
    required: true
  })
  genreId: Number

  @prop({
    default: []
  })
  topSongIds: [Number]
}

export const PopularChartModel = new PopularChart().getModelForClass(PopularChart, {
  schemaOptions: {
    timestamps: true,
    collection: COLLECTION_POPULARCHARTS
  }
})

export const PopularChartProcessingModel = new PopularChart().getModelForClass(PopularChart, {
  schemaOptions: {
    timestamps: true,
    collection: COLLECTION_POPULARCHARTS_PROCESSING
  }
})
