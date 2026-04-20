import { Response } from "express"
import type { ApiResponse } from "../shared/types"

export const sendSuccessResponse  = <T> (
    res:Response,
    data:T,
    message = "Success",
    statusCode = 200

)=>{
const response :ApiResponse<T> = {success:true,message,data,error:null}
return res.status(statusCode).json(response)
}

export const sendErrorResponse  =  <T>(
res:Response,
error:Record<string,string>|null,
message="Something went wrong",
statusCode=500

)=>{
    const response  :ApiResponse<null> = {
        success:false,
        message,
        data:null,
        error
    }
    return res.status(statusCode).json(response)

}