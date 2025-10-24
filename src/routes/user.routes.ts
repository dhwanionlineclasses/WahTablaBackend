import { Router } from "express";
import {
    registerUser,
    loginUser,
    logoutUser,
    refreshAccessToken,
    changePassword,
    googleAuthController,
    getUsers,
    forgotPassword,
    resetPassword
} from "../controllers/user.controller";
import verifyJWT from "../middlewares/auth.middleware";

const router = Router();

router.route("/register").post(registerUser);
router.route("/login").post(loginUser);
router.route("/get").get(getUsers);
router.route("/forgot-password").get(forgotPassword);
router.route("/reset-password").get(resetPassword);
router.route("/logout").post(verifyJWT, logoutUser);
router.route("/refresh-token").post(refreshAccessToken);
router.route("/change-password").put(verifyJWT, changePassword);
router.get("/google", googleAuthController.redirectToGoogle);
router.get("/google/callback", googleAuthController.googleCallback);

export default router;
