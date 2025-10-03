import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware";
import { getProfile, getUserProfile, updateUserDetails, getUserProfileLastPurchase } from "../controllers/userProfile.controller";

const router = Router();

router.get('/getProfile', verifyJWT, getUserProfile);
router.get('/getLastPurchase', verifyJWT, getUserProfileLastPurchase);
router.put('/', verifyJWT, updateUserDetails);
router.get('/', verifyJWT, getProfile);


export default router;
