// middleware/adminAuth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import { verifyAdminAccessToken } from '../utils/adminTokenUtils';
import ApiError from '../utils/ApiError';
import { AdminWithoutPassword } from '../@types/admin.types';

interface AdminRequest extends Request {
  admin?: AdminWithoutPassword;
}

const adminAuth = (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    const token = req.cookies?.adminAccessToken || req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      throw new ApiError(401, 'Admin access token is required');
    }

    const { valid, decoded } = verifyAdminAccessToken(token);

    if (!valid || !decoded || typeof decoded !== 'object') {
      throw new ApiError(401, 'Invalid admin access token');
    }

    req.admin = decoded.admin;
    next();
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(401).json({
        success: false,
        message: 'Admin token verification failed',
      });
    }
  }
};

export default adminAuth;
