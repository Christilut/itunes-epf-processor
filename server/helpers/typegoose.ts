import * as mongoose from 'mongoose'
import { InstanceType } from 'typegoose'

export function generateModel<T>(model: mongoose.Model<InstanceType<T>>, name: string): mongoose.Model<InstanceType<T>> {
  return mongoose.model(name, model.schema, name) as mongoose.Model<InstanceType<T>>
}
