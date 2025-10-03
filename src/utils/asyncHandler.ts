import { Request, Response, NextFunction } from 'express';
import ApiError from './ApiError';

const asyncHandler = (fn: (req: Request, res: Response, next: NextFunction) => Promise<void>) =>
    async (req: Request, res: Response, next: NextFunction): Promise<void> => {
      try {
        await fn(req, res, next);
      } catch (error) {
        if (error instanceof ApiError) {
          // Use the custom status code and message from ApiError
          res.status(error.statusCode).json({
            success: error.success,
            message: error.message,
            errors: error.errors,
            data: error.data
          });
        } else {
          // Fallback for unexpected errors
          res.status(500).json({
            success: false,
            message: "Something went wrong",
          });
        }
      }
    };

export default asyncHandler;
