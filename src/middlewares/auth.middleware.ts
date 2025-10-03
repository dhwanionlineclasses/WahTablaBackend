import { Request, Response, NextFunction } from 'express';
import jwt, { JwtPayload } from 'jsonwebtoken';
import ApiError from '../utils/ApiError';
import asyncHandler from '../utils/asyncHandler';
import db from '../db/db_connect';
import { users, User } from  '../models';
import { eq } from 'drizzle-orm';


const verifyJWT = asyncHandler(async (req: Request, res: Response, next: NextFunction): Promise<void>  => {
    // Get the token from cookies or headers
    // Check if the token exists
    // Verify the token using promises
    // Fetch the user from the database
    // check if the user exists
    // Attach the user to the request object, excluding sensitive field
    // Call the next middleware
    // console.log("User verification");
    const token = req.cookies?.accessToken || req.header("Authorization")?.replace("Bearer ", "");
    if (!token) {
        throw new ApiError(401, "Access token is required");
    }

    // Verify the token using promises
    try {
        const decodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET as string) as JwtPayload;
        const user: User = await db
        .select()
        .from(users)
        .where(eq(users.userId,decodedToken.user.userId))
        .limit(1)
        .then(rows => rows[0]);

        if (!user) {
            return next(new ApiError(401, "Invalid Access Token"));
        }
        req.user = { userId: user.userId, username: user.username, email: user.email } as User;
        // console.log("User verified:", req.user);
        next();
    } catch (err) {
        next(new ApiError(403, "Invalid access token"));
    }
});

export default verifyJWT;
