import { Request, Response } from "express";
import db from "../db/db_connect";
import { videoAnalytics, VideoAnalytics, NewVideoAnalytics } from "../models/videoAnalytics.model";
import { users, User } from "../models/user.model";
import { videoAnalyticsSchema, updateVideoAnalyticsSchema } from "../schemas/videoAnalyticsSchema";
import { eq, and, is } from "drizzle-orm";
import asyncHandler from "../utils/asyncHandler";
import ApiError from "../utils/ApiError";
import ApiResponse from "../utils/ApiResponse";
import z from "zod";


/**
 * Add new video analytics
 */
const addVideoAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  try {
    const userTest = req.user;
    const userId = userTest?.userId;

    const { isNextVideo } = z.object({
      isNextVideo: z.preprocess(
        (val) => {
          if (val === "true") return true;
          if (val === "false") return false;
          return val;
        },
        z.boolean()
      ),
    }).parse(req.params);

    if (!userId) {
      throw new ApiError(400, "userId is required");
    }

    const { analytics } = req.body;

    if (!Array.isArray(analytics)) {
      throw new ApiError(400, "analytics must be an array with two objects");
    }

    const [prevAnalyticsData, newAnalyticsData] = analytics;

    // -----------------------------
    // Step 1: Update previous analytics
    // -----------------------------
    const validatedPrevAnalytics = updateVideoAnalyticsSchema.parse(prevAnalyticsData);

    const [updatedPrevAnalytics]: VideoAnalytics[] = await db
      .update(videoAnalytics)
      .set({ ...validatedPrevAnalytics })
      .where(and(
        eq(videoAnalytics.userId, userId),
        eq(videoAnalytics.analyticsId, prevAnalyticsData.analyticsId)
      ))
      .returning();

    if (!updatedPrevAnalytics) {
      throw new ApiError(404, "Previous video analytics record not found for update");
    }

    // -----------------------------
    // Step 2: Insert new analytics
    // -----------------------------

    if (isNextVideo) {
      const { analyticsId, ...analyticsData } = newAnalyticsData;
      const insertData: NewVideoAnalytics = {
        ...analyticsData,
        startDate: new Date(newAnalyticsData.startDate),
        endDate: newAnalyticsData.endDate ? new Date(newAnalyticsData.endDate) : null,
      };

      const validatedNewAnalytics = videoAnalyticsSchema.parse(insertData);

      const [newAnalytics]: NewVideoAnalytics[] = await db
        .insert(videoAnalytics)
        .values(validatedNewAnalytics)
        .returning();

      if (!newAnalytics) {
        throw new ApiError(500, "Failed to create new video analytics record");
      }
    }

    // -----------------------------
    // Step 3: Fetch all analytics for user
    // -----------------------------
    const allAnalytics = await db
      .select()
      .from(videoAnalytics)
      .where(eq(videoAnalytics.userId, userId));

    res.status(201).json(
      new ApiResponse(201, { analytics: allAnalytics }, "Video analytics updated and new record created successfully")
    );

  } catch (error) {
    console.log({ error })
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: error.errors[0].message });
      return;
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "An error occurred while processing video analytics");
  }
});


/**
 * Update existing video analytics (by user & video)
 */
const updateVideoAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId, videoId } = req.body;

  if (!userId || !videoId) {
    throw new ApiError(400, "userId and videoId are required");
  }

  try {
    // Verify user exists
    const user: User[] = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (user.length === 0) {
      throw new ApiError(404, "User not found");
    }

    // Use the update schema (all fields optional)
    const validatedUpdates = updateVideoAnalyticsSchema.parse(req.body);

    const [updatedAnalytics]: VideoAnalytics[] = await db
      .update(videoAnalytics)
      .set({ ...validatedUpdates })
      .where(and(eq(videoAnalytics.userId, userId), eq(videoAnalytics.videoId, videoId)))
      .returning();

    if (!updatedAnalytics) {
      throw new ApiError(404, "Video analytics record not found for update");
    }

    res.status(200).json(
      new ApiResponse(200, { analytics: updatedAnalytics }, "Video analytics updated successfully")
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ success: false, message: error.errors[0].message });
      return;
    }
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "An error occurred while updating video analytics");
  }
});


/**
 * Fetch analytics for a single video by user
 */
const getVideoAnalytics = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const { userId, videoId } = req.query;

  if (!userId || !videoId) {
    throw new ApiError(400, "userId and videoId are required");
  }

  try {
    const analytics: VideoAnalytics[] = await db
      .select()
      .from(videoAnalytics)
      .where(and(eq(videoAnalytics.userId, Number(userId)), eq(videoAnalytics.videoId, Number(videoId))))
      .limit(1);

    if (analytics.length === 0) {
      throw new ApiError(404, "Video analytics record not found");
    }

    res.status(200).json(
      new ApiResponse(200, { analytics: analytics[0] }, "Video analytics retrieved successfully")
    );
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "An error occurred while fetching video analytics");
  }
});


/**
 * Fetch analytics for a single video by user
 */
const getAllVideoAnalyticsForUser = asyncHandler(async (req: Request, res: Response): Promise<void> => {
  const user = req.user;
  const userId = user?.userId;

  if (!userId) {
    throw new ApiError(400, "userId is required");
  }

  try {
    const analytics: VideoAnalytics[] = await db
      .select()
      .from(videoAnalytics)
      .where(eq(videoAnalytics.userId, Number(userId)));


    if (analytics.length === 0) {
      throw new ApiError(404, "No video analytics records found for this user");
    }

    res.status(200).json(
      new ApiResponse(200, { analytics }, "All video analytics retrieved successfully")
    );
  } catch (error) {
    console.log(error);
    if (error instanceof ApiError) throw error;
    throw new ApiError(500, "An error occurred while fetching all video analytics");
  }
});

export { addVideoAnalytics, updateVideoAnalytics, getVideoAnalytics, getAllVideoAnalyticsForUser };
