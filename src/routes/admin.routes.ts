// routes/admin.routes.ts
import { Router } from 'express';
import {
  registerAdmin,
  loginAdmin,
  refreshAdminAccessToken,
  logoutAdmin,
  changeAdminPassword,
  // getAdminProfile
} from '../controllers/admin.controller';
import adminAuth from '../middlewares/adminAuth.middleware';
import { requireAdminRole, requireUserRole } from '../middlewares/adminRoleAuth.middleware';
import {
  updateAdminRole, 
  deleteAdmin, 
  getAdminDetails,
  getAllAdmins,
  toggleAdminStatus,
} from '../controllers/adminAction.controller';

import { 
  getEntranceExamAttemptsForReview,
  getExamAttemptsForReview,
  updateExamAttempt,
  uploadCertificate, 
} from '../controllers/admin/examAttempts.controller';
import { getUsersBasicDetails, getUserSpecificDetails } from '../controllers/admin/users.controller';

const router = Router();

router.post('/register', registerAdmin);
router.post('/login', loginAdmin);
router.post('/refresh-token', refreshAdminAccessToken);

// // Protected routes - require admin authentication
router.use(adminAuth); 
router.get('/students', requireAdminRole, getUsersBasicDetails);
router.post('/logout', logoutAdmin);
router.post('/change-password', requireUserRole, changeAdminPassword);


// // Admin-only routes (require 'admin' role)
router.get('/exam-attempts', requireAdminRole, getExamAttemptsForReview);
router.get('/entrance-exam-attempts', requireAdminRole, getEntranceExamAttemptsForReview);
router.get('/users', requireAdminRole, getAllAdmins);
router.get('/:adminId', requireAdminRole, getAdminDetails);
router.patch('/role', requireAdminRole, updateAdminRole);
router.delete('/:adminId', requireAdminRole, deleteAdmin);
router.patch('/:adminId/toggle-status', requireAdminRole, toggleAdminStatus);


// getting all examAttempted by students
router.put('/exam-attempts', requireAdminRole, updateExamAttempt);
router.post('/exam-attempts/certificate', requireAdminRole, uploadCertificate);

//get all user details
router.get('/students/:userId/details', requireAdminRole, getUserSpecificDetails);

export default router;
