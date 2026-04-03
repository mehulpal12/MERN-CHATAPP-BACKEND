import type { NextFunction, Request, Response } from "express";
import type { IUser } from "../model/user.js";
import jwt, { type JwtPayload } from "jsonwebtoken";

export interface AuthenticatedRequest extends Request{
    user?: IUser | null;
}

export const isAuth = async(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
    try{
        const authHeader = req.headers.authorization;
        if(!authHeader || !authHeader.startsWith("Bearer ")){
            res.status(401).json({message: "please login - no auth header"});
            return;
        }
        const token = authHeader.split(" ")[1] as string;
        const JWT_SECRET = process.env.JWT_SECRET as string
        const decodedToken = jwt.verify(token, JWT_SECRET as string) as JwtPayload;
        
        if(!decodedToken || !decodedToken.user){
             res.status(401).json({message: "Invalid token no auth header"});
             return;
        }
        req.user = decodedToken.user;
        next();
    }catch(error){
        console.log(error);
        res.status(500).json({message: "Internal server error"});
        return;
    }
}