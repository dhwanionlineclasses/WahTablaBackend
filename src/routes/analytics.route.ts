import { Router } from "express";
import {
  addVideoAnalytics,
  updateVideoAnalytics,
  getVideoAnalytics,
  getAllVideoAnalyticsForUser
} from "../controllers/videoAnalytics.controller";
import verifyJWT from "../middlewares/auth.middleware";

const router = Router();

// Add a new video analytics entry
router.post("/add/:isNextVideo", verifyJWT, addVideoAnalytics);

// Update analytics for a video (by analyticsId or videoId)
router.put("/update/:analyticsId", verifyJWT, updateVideoAnalytics);

// Fetch analytics for a single video by videoId
// router.get("/video/:videoId", verifyJWT, getVideoAnalyticsByVideo);

// Fetch all analytics for a user
router.get("/user", verifyJWT, getAllVideoAnalyticsForUser);

// // Delete analytics entry (if needed)
// router.delete("/delete/:analyticsId", verifyJWT, deleteVideoAnalytics);

export default router;
