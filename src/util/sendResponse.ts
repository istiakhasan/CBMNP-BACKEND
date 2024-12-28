import { Response } from 'express'

export type IResponse<T> = {
  success: boolean
  statusCode: number
  message: string
  meta?: {
    page: number
    limit: number
    total: number
  }
  data: T
}

const sendResponse = <T>( data: IResponse<T>) => {
  const responseData = {
    success: data.success,
    statusCode: data.statusCode,
    message: data.message,
    meta: data.meta || null || undefined,
    data: data.data,
  }
  return {...responseData}
//   res.status(data.statusCode).json(responseData)
}

export default sendResponse