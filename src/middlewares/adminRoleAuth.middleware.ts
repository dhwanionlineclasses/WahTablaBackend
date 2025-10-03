// middleware/adminRoleAuth.middleware.ts
import { Request, Response, NextFunction } from 'express';
import ApiError from '../utils/ApiError';
import { AdminWithoutPassword } from '../@types/admin.types';

interface AdminRequest extends Request {
  admin?: AdminWithoutPassword;
}


export const requireAdminRole = (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.admin) {
      throw new ApiError(401, 'Admin authentication required');
    }

    if (req.admin.role !== 'admin') {
      throw new ApiError(403, 'Admin privileges required. Contact an administrator to upgrade your account.');
    }

    if (!req.admin.isActive) {
      throw new ApiError(403, 'Account is deactivated. Contact an administrator.');
    }

    next();
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    } else {
      res.status(403).json({
        success: false,
        message: 'Insufficient privileges',
      });
    }
  }
};


export const requireUserRole = (req: AdminRequest, res: Response, next: NextFunction) => {
  try {
    if (!req.admin) {
      throw new ApiError(401, 'Admin authentication required');
    }

    if (!req.admin.isActive) {
      throw new ApiError(403, 'Account is deactivated. Contact an administrator.');
    }

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
        message: 'Authentication failed',
      });
    }
  }
};

// Optional: Middleware to check if admin can perform specific actions
export const canManageUsers = requireAdminRole;
export const canManageExams = requireAdminRole;
export const canIssueCertificates = requireAdminRole;
