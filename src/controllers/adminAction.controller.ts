// controllers/adminAction.controller.ts
import { Request, Response } from "express";
import db from "../db/db_connect";
import { admins } from "../models";
import { eq, and, ilike, sql } from "drizzle-orm";
import ApiError from "../utils/ApiError";
import ApiResponse from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import z from "zod";
import { AdminWithoutPassword } from "../@types/admin.types";
import { 
  updateAdminRoleSchema, 
  adminUserFilterSchema,
  deleteAdminSchema 
} from "../schemas/adminSchema";

interface AdminRequest extends Request {
  admin?: AdminWithoutPassword;
}



const updateAdminRole = asyncHandler(async (req: AdminRequest, res: Response) => {
  const currentAdmin = req.admin;
  
  if (currentAdmin?.role !== 'admin') {
    throw new ApiError(403, 'Only admins can change admin user roles');
  }

  try {
    const { adminId, role, isActive } = updateAdminRoleSchema.parse(req.body);

    if (!adminId) {
      throw new ApiError(400, 'Admin ID is required');
    }

    if (adminId === currentAdmin.adminId && role === 'user') {
      throw new ApiError(400, 'You cannot demote yourself from admin role');
    }

    const existingAdmin = await db
      .select()
      .from(admins)
      .where(eq(admins.adminId, adminId))
      .limit(1);

    if (existingAdmin.length === 0) {
      throw new ApiError(404, 'Admin user not found');
    }

    if (role !== undefined && existingAdmin[0].role === role) {
      throw new ApiError(400, `Admin user already has the role: ${role}`);
    }

    const updateData: any = { updatedAt: new Date() };
    
    if (role !== undefined) {
      updateData.role = role;
    }
    
    if (isActive !== undefined) {
      updateData.isActive = isActive;
    }

    const [updatedAdmin] = await db
      .update(admins)
      .set(updateData)
      .where(eq(admins.adminId, adminId))
      .returning();

    if (!updatedAdmin) {
      throw new ApiError(500, 'Failed to update admin user');
    }

    const { password: _, ...adminWithoutPassword } = updatedAdmin;

    res.status(200).json(
      new ApiResponse(
        200, 
        { admin: adminWithoutPassword }, 
        `Admin user ${role ? `role updated to ${role}` : 'status updated'} successfully`
      )
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
      return;
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "An error occurred while updating admin user");
  }
});


const deleteAdmin = asyncHandler(async (req: AdminRequest, res: Response) => {
  const currentAdmin = req.admin;
  
  if (currentAdmin?.role !== 'admin') {
    throw new ApiError(403, 'Only admins can delete admin users');
  }

  try {
    const { adminId } = deleteAdminSchema.parse(req.params);

    if (adminId === currentAdmin.adminId) {
      throw new ApiError(400, 'You cannot delete your own admin account');
    }

    const existingAdmin = await db
      .select({
        adminId: admins.adminId,
        email: admins.email,
        role: admins.role
      })
      .from(admins)
      .where(eq(admins.adminId, adminId))
      .limit(1);

    if (existingAdmin.length === 0) {
      throw new ApiError(404, 'Admin user not found');
    }

    const deletedAdmins = await db
      .delete(admins)
      .where(eq(admins.adminId, adminId))
      .returning();

    if (deletedAdmins.length === 0) {
      throw new ApiError(500, 'Failed to delete admin user');
    }

    res.status(200).json(
      new ApiResponse(
        200, 
        { 
          deletedAdmin: { 
            adminId, 
            email: existingAdmin[0].email,
            role: existingAdmin[0].role
          } 
        }, 
        'Admin user deleted successfully'
      )
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
      return;
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "An error occurred while deleting admin user");
  }
});


const getAdminDetails = asyncHandler(async (req: AdminRequest, res: Response) => {
  const currentAdmin = req.admin;
  
  if (currentAdmin?.role !== 'admin') {
    throw new ApiError(403, 'Only admins can view admin user details');
  }

  try {
    const { adminId } = deleteAdminSchema.parse(req.params);

    const admin = await db
      .select({
        adminId: admins.adminId,
        email: admins.email,
        role: admins.role,
        isActive: admins.isActive,
        createdAt: admins.createdAt,
        updatedAt: admins.updatedAt
      })
      .from(admins)
      .where(eq(admins.adminId, adminId))
      .limit(1);

    if (admin.length === 0) {
      throw new ApiError(404, 'Admin user not found');
    }

    res.status(200).json(
      new ApiResponse(200, { admin: admin[0] }, 'Admin user details retrieved successfully')
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
      return;
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "An error occurred while fetching admin user details");
  }
});

const getAllAdmins = asyncHandler(async (req: AdminRequest, res: Response) => {
  const currentAdmin = req.admin;
  
  if (currentAdmin?.role !== 'admin') {
    throw new ApiError(403, 'Only admins can view admin user list');
  }

  try {
    const { page = 1, limit = 10, role, isActive, search } = adminUserFilterSchema.parse(req.query);
    
    const whereConditions = [];
    
    if (role) {
      whereConditions.push(eq(admins.role, role));
    }
    
    if (typeof isActive === 'boolean') {
      whereConditions.push(eq(admins.isActive, isActive));
    }

    if (search) {
      whereConditions.push(ilike(admins.email, `%${search}%`));
    }

    const adminsList = await db.select({
      id: admins.adminId,
      name: admins.name,
      email: admins.email,
      role: admins.role,
      isActive: admins.isActive,
      createdAt: admins.createdAt,
      updatedAt: admins.updatedAt
    }).from(admins)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .limit(limit || 10)
      .offset(((page || 1) - 1) * (limit || 10))
      .orderBy(admins.createdAt);


    const totalAdmins = await db.select({ count: sql`count(*)` }).from(admins)
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    res.status(200).json(
      new ApiResponse(200, {
        admins: adminsList,
        pagination: {
          page: page || 1,
          limit: limit || 10,
          total: Number(totalAdmins[0].count)
        }
      }, 'Admin users retrieved successfully')
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
      return;
    }
    throw new ApiError(500, "An error occurred while fetching admin users");
  }
});


const toggleAdminStatus = asyncHandler(async (req: AdminRequest, res: Response) => {
  const currentAdmin = req.admin;
  
  if (currentAdmin?.role !== 'admin') {
    throw new ApiError(403, 'Only admins can change admin user status');
  }

  try {
    const { adminId } = deleteAdminSchema.parse(req.params);

    if (adminId === currentAdmin.adminId) {
      throw new ApiError(400, 'You cannot deactivate your own admin account');
    }

    const existingAdmin = await db
      .select({
        adminId: admins.adminId,
        email: admins.email,
        isActive: admins.isActive,
        role: admins.role
      })
      .from(admins)
      .where(eq(admins.adminId, adminId))
      .limit(1);

    if (existingAdmin.length === 0) {
      throw new ApiError(404, 'Admin user not found');
    }

    const newStatus = !existingAdmin[0].isActive;

    const [updatedAdmin] = await db
      .update(admins)
      .set({ 
        isActive: newStatus,
        updatedAt: new Date()
      })
      .where(eq(admins.adminId, adminId))
      .returning();

    if (!updatedAdmin) {
      throw new ApiError(500, 'Failed to update admin user status');
    }

    const { password: _, ...adminWithoutPassword } = updatedAdmin;

    res.status(200).json(
      new ApiResponse(
        200, 
        { admin: adminWithoutPassword }, 
        `Admin user ${newStatus ? 'activated' : 'deactivated'} successfully`
      )
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
      return;
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "An error occurred while updating admin user status");
  }
});




export { 
  updateAdminRole, 
  deleteAdmin, 
  getAdminDetails,
  getAllAdmins,
  toggleAdminStatus,
};
