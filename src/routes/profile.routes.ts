import { Router } from "express";
import verifyJWT from "../middlewares/auth.middleware";
import { getProfile, getUserProfile, updateUserDetails, getUserLastPurchase } from "../controllers/userProfile.controller";

const router = Router();

router.get('/getProfile', verifyJWT, getUserProfile);
router.get('/getLastPurchase', verifyJWT, getUserLastPurchase);
router.put('/', verifyJWT, updateUserDetails);
router.get('/', verifyJWT, getProfile);


export default router;
