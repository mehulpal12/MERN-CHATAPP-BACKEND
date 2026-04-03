import type { NextFunction, Request, RequestHandler, Response } from "express";

const tryCatch = (Handler: RequestHandler) => {
    return async(req: Request, res: Response, next: NextFunction) => {
        try {
            await Handler(req, res, next);
        } catch (error) {
            console.log(error);
            res.status(500).json({ message: "Internal server error" });
        }
    }
}

export default tryCatch;
