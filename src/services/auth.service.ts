
import { googleClient } from "../config/googleAuth";
import jwt from "jsonwebtoken";
import axios from "axios";
import  db  from "../db/db_connect";
import { users } from "../models/user.model";
import { refreshTokens } from "../models";
import { eq } from "drizzle-orm";
import {
    generateAccessToken,
    generateRefreshToken,
} from "../utils/tokenUtils";

export const authenticateGoogleUser = async (code: string) => {
  // Exchange authorization code for tokens
  const { tokens } = await googleClient.getToken(code);
  googleClient.setCredentials(tokens);

  // Fetch user details from Google API
  const { data: userInfo } = await axios.get(
    `https://www.googleapis.com/oauth2/v2/userinfo?access_token=${tokens.access_token}`
  );

  let user = await db.select().from(users).where(eq(users.email,userInfo.email));

  if (user.length === 0) {
    // Register new user
    const insertedUser = await db
      .insert(users)
      .values({
        username: userInfo.name,
        email: userInfo.email,
        password: "", // No password for OAuth users
      })
      .returning();
    user = insertedUser;
  }

  const userWithoutPassword = {
    username: user[0].username,
    email: user[0].email,
    userId: user[0].userId,
  };

  // Generate JWT tokens
    const accessToken = generateAccessToken(userWithoutPassword);
    const refreshToken = generateRefreshToken(userWithoutPassword);


  // Store refresh token in DB
  await db.insert(refreshTokens).values({
    token: refreshToken,
    userId: user[0].userId,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
  });

  return { accessToken, refreshToken };
};
