import { Request, Response } from "express";
import { signUpSchema } from "../schemas/signUpSchema";
import db from "../db/db_connect";
import { users, refreshTokens, User, NewUser, RefreshToken } from "../models";
import { eq, sql } from "drizzle-orm";
import ApiError from "../utils/ApiError";
import { comparePassword, hashPassword } from "../utils/passwordUtils";
import ApiResponse from "../utils/ApiResponse";
import { loginSchema } from "../schemas/loginSchema";
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
} from "../utils/tokenUtils";
import asyncHandler from "../utils/asyncHandler";
import z from "zod";
import { changePasswordSchema } from "../schemas/changePasswordSchema";
import { authenticateGoogleUser } from "../services/auth.service";
import { resend } from "../lib/resend";

// Cookie options for secure storage
const cookieOptions = {
  httpOnly: true,
  secure: true, // Always set to true
  sameSite: 'strict' as const, // Corrected to lowercase
};

const registerUser = asyncHandler(async (req: Request, res: Response) => {
  // get user details from frontend
  // validation - not empty
  // check if user exists: email
  // hash password
  // save user to db
  // check for user creation
  // send response
  try {

    // Validate user input
    const validatedData = signUpSchema.parse(req.body);

    const existingUser: User[] = await db
      .select()
      .from(users)
      .where(eq(users.email, validatedData.email))
      .limit(1);

    if (existingUser.length > 0) {
      throw new ApiError(409, "User already exists");
    }

    const hashedPassword = await hashPassword(validatedData.password);

    const [newUser]: NewUser[] = await db
      .insert(users)
      .values({
        username: validatedData.username,
        email: validatedData.email,
        password: hashedPassword,
        createdAt: new Date(),
        updatedAt: new Date(),
      })
      .returning();

    if (!newUser || !newUser.userId) {
      throw new ApiError(500, "User creation failed");
    }

    const [savedUser]: User[] = await db
      .select()
      .from(users)
      .where(eq(users.userId, newUser.userId))
      .limit(1);
    if (!savedUser) {
      throw new ApiError(500, "An error occurred while registering the user");
    }
    // Exclude sensitive fields from the response user object
    const { password: _, ...userWithoutPassword } = savedUser;

    await resend.emails.send({
      from: 'onboarding@resend.dev', // or your verified domain
      to: validatedData.email,
      subject: '🙏 Namaste! Welcome to Wah Tabla — Let the Rhythm Begin 🎶',
      html: `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: hsl(240, 10%, 3.9%); padding: 30px; color: hsl(0, 0%, 98%);">
      <div style="max-width: 600px; margin: auto; background: hsl(240, 10%, 3.9%); border-radius: 12px; overflow: hidden; border: 1px solid hsl(0, 0%, 20%);">

        <div style="text-align: center; padding: 30px 20px; border-bottom: 1px solid hsl(0, 0%, 15%);">
          <h1 style="margin: 0; font-size: 26px; color: hsl(0, 0%, 98%);">Namaste 🙏</h1>
          <h2 style="margin-top: 10px; font-size: 20px; color: hsl(35, 100%, 60%);">Welcome to WahTabla.com</h2>
        </div>

        <div style="padding: 30px 25px;">
          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            A very warm welcome to <strong>WahTabla.com!</strong><br/>
            We’re truly delighted to have you as part of our musical family.
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            At Wah Tabla, our goal is to make your learning journey inspiring and enjoyable. 
            We hope each lesson brings you closer to discovering the beauty and depth of rhythm.
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            Thank you for choosing to begin your <strong>tabla journey</strong> with us.
          </p>

          <div style="text-align: center; margin-top: 35px;">
            <a href="https://wahtabla.com/login"
              style="background: hsl(35, 100%, 60%); color: hsl(240, 10%, 3.9%);
              padding: 12px 30px; text-decoration: none; border-radius: 8px;
              font-weight: 600; font-size: 15px; letter-spacing: 0.5px;">
              Start Your Rhythm Journey 🎵
            </a>
          </div>
        </div>

        <div style="border-top: 1px solid hsl(0, 0%, 15%); padding: 20px; text-align: center; font-size: 13px; color: hsl(0, 0%, 70%);">
          © ${new Date().getFullYear()} Wah Tabla — All Rights Reserved<br/>
          <a href="https://wahtabla.com" style="color: hsl(35, 100%, 60%); text-decoration: none;">Visit WahTabla.com</a>
        </div>
      </div>
    </div>
  `
    });

    await resend.emails.send({
      from: 'onboarding@resend.dev', // your verified sender
      to: 'wahhtabla@gmail.com', // or your admin email
      subject: '🔔 New User Registration — Wah Tabla',
      html: `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: hsl(240, 10%, 3.9%); padding: 30px; color: hsl(0, 0%, 98%);">
      <div style="max-width: 600px; margin: auto; background: hsl(240, 10%, 3.9%); border-radius: 12px; overflow: hidden; border: 1px solid hsl(0, 0%, 20%); box-shadow: 0 4px 12px rgba(0,0,0,0.3);">
        
        <div style="background: linear-gradient(90deg, #ff8800, #ff4b2b); padding: 20px; color: white; text-align: center;">
          <h2 style="margin: 0;">New User Registration</h2>
        </div>

        <div style="padding: 25px;">
          <p style="font-size: 16px;">Hello Admin,</p>
          <p style="font-size: 16px;">
            A new user has just registered on <strong>Wah Tabla</strong>.
          </p>

          <table style="width: 100%; font-size: 15px; border-collapse: collapse; margin-top: 10px; color: hsl(0, 0%, 90%);">
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid hsl(0, 0%, 25%);"><strong>Username:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid hsl(0, 0%, 25%);">${validatedData.username}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid hsl(0, 0%, 25%);"><strong>Email:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid hsl(0, 0%, 25%);">${validatedData.email}</td>
            </tr>
            <tr>
              <td style="padding: 8px; border-bottom: 1px solid hsl(0, 0%, 25%);"><strong>Registration Date:</strong></td>
              <td style="padding: 8px; border-bottom: 1px solid hsl(0, 0%, 25%);">${new Date().toLocaleString()}</td>
            </tr>
          </table>

          <p style="font-size: 15px; margin-top: 25px; color: hsl(0, 0%, 85%);">
            Please check the admin dashboard for more details.
          </p>
        </div>

        <div style="border-top: 1px solid hsl(0, 0%, 15%); background: hsl(240, 10%, 5%); padding: 15px; text-align: center; font-size: 13px; color: hsl(0, 0%, 70%);">
          © ${new Date().getFullYear()} Wah Tabla — Admin Notification
        </div>

      </div>
    </div>
  `
    });
    res
      .status(201)
      .json(
        new ApiResponse(
          200,
          { user: userWithoutPassword },
          "User created successfully"
        )
      );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }

    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    res.status(500).json({
      success: false,
      message: "An error occurred while registering the user",
    });
  }
});

const loginUser = asyncHandler(async (req: Request, res: Response) => {
  // get user details from frontend
  // validation - not empty
  // find the user
  // password check
  // access and refresh token generation
  // send cookies
  // send response
  try {
    const { email, password } = loginSchema.parse(req.body);
    // find the user
    const user: User[] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      throw new ApiError(404, "User not found");
    }
    // password check
    const isPasswordValid = await comparePassword(password, user[0].password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid credentials");
    }


    const { password: _, createdAt, updatedAt, ...userWithoutPassword } = user[0];


    const accessToken = generateAccessToken(userWithoutPassword);
    const refreshToken = generateRefreshToken(userWithoutPassword);

    // store refresh token in the database with expiration time
    await db.insert(refreshTokens).values({
      token: refreshToken,
      userId: user[0].userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
    });

    res.cookie("accessToken", accessToken, {
      ...cookieOptions,
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    });
    res.cookie("refreshToken", refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
    });

    res.status(200).json(
      new ApiResponse(
        200,
        {
          user: userWithoutPassword,
          accessToken,
          refreshToken,
        },
        "User logged in successfully"
      )
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "An error occurred while logging in the user");
  }
});

const logoutUser = asyncHandler(async (req: Request, res: Response) => {
  // get refresh token from cookies
  // check if the refresh token exists
  // delete the refresh token from the database
  // clear access and refresh token cookies
  // send response
  const refreshToken = req.cookies?.refreshToken;
  if (!refreshToken) {
    throw new ApiError(400, "Refresh token is missing");
  }

  await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));

  res.clearCookie("accessToken", cookieOptions);
  res.clearCookie("refreshToken", cookieOptions);

  res.status(200).json(new ApiResponse(200, null, "User logged out successfully"));
});

const refreshAccessToken = asyncHandler(async (req: Request, res: Response) => {
  const { refreshToken } = req.cookies;

  if (!refreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }

  try {
    // Verify refresh token validity
    const { valid, decoded } = verifyRefreshToken(refreshToken);
    if (
      !valid ||
      !decoded ||
      typeof decoded !== "object" ||
      !(decoded.user.userId)
    ) {
      throw new ApiError(403, "Invalid refresh token");
    }

    // Check if refresh token exists in the database and is not expired
    const storedToken = await db
      .select()
      .from(refreshTokens)
      .where(
        sql`${refreshTokens.token} = ${refreshToken} AND ${refreshTokens.expiresAt
          } > ${new Date()}`
      )
      .limit(1);

    if (storedToken.length === 0) {
      throw new ApiError(403, "Refresh token not found or expired");
    }

    // Generate a new access token and refresh token
    const newAccessToken = generateAccessToken(decoded.user.userId);
    const newRefreshToken = generateRefreshToken(decoded.user.userId);

    // Store new refresh token in the database
    await db.insert(refreshTokens).values({
      token: newRefreshToken,
      userId: decoded.user.userId,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days expiration
    });

    // Delete the old refresh token from the database
    await db.delete(refreshTokens).where(eq(refreshTokens.token, refreshToken));

    // Set cookies with the new tokens
    res.cookie("accessToken", newAccessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000,
    }); // 15 min
    res.cookie("refreshToken", newRefreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    }); // 7 days

    res
      .status(200)
      .json(
        new ApiResponse(
          200,
          { accessToken: newAccessToken, refreshToken: newRefreshToken },
          "Access token refreshed successfully"
        )
      );
  } catch (error) {
    if (error instanceof ApiError) {
      res.status(error.statusCode).json({
        statusCode: error.statusCode,
        message: error.message, // Explicitly include error message here
        success: false,
      });
    } else {
      res
        .status(500)
        .json({
          statusCode: 500,
          message: "An error occurred while refreshing the access token",
          success: false,
        });
    }
  }
});

const changePassword = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) {
    throw new ApiError(401, "User not authenticated");
  }
  try {
    const { oldPassword, newPassword } = changePasswordSchema.parse(req.body);

    const user = await db
      .select()
      .from(users)
      .where(eq(users.userId, userId))
      .limit(1);

    if (user.length === 0) {
      throw new ApiError(404, "User not found");
    }

    const isPasswordValid = await comparePassword(oldPassword, user[0].password);
    if (!isPasswordValid) {
      throw new ApiError(401, "Invalid credentials");
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.update(users).set({ password: hashedPassword }).where(eq(users.userId, userId));

    res.status(200).json(new ApiResponse(200, null, "Password changed successfully"));
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "An error occurred while changing the password");

  }
});

const googleAuthController = {
  redirectToGoogle: (req: Request, res: Response) => {
    res.redirect("https://accounts.google.com/o/oauth2/auth" +
      "?response_type=code" +
      `&client_id=${process.env.GOOGLE_CLIENT_ID}` +
      `&redirect_uri=${process.env.BACKEND_URL}/auth/google/callback` +
      "&scope=profile email"
    );
  },

  googleCallback: asyncHandler(async (req: Request, res: Response): Promise<void> => {
    const { code } = req.query;

    if (!code) {
      throw res.status(400).json({ message: "Authorization code is missing" });
    }

    try {
      const tokens = await authenticateGoogleUser(code as string);
      res.json(tokens);
    } catch (error) {
      console.error("Google OAuth Error:", error);
      res.status(500).json({ message: "Authentication failed" });
    }
  }),
};

const getUsers = asyncHandler(async (req: Request, res: Response) => {
  // get user details from frontend
  // validation - not empty
  // find the user
  // password check
  // access and refresh token generation
  // send cookies
  // send response
  try {
    // find the user
    const allUsers: User[] = await db
      .select()
      .from(users)

    // console.log("All users retrieved:", allUsers);

    res.status(200).json(
      new ApiResponse(
        200,
        {
          user: allUsers,
        },
        "Users retrieved successfully"
      )
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({
        success: false,
        message: error.errors[0].message,
      });
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, "An error occurred while fetching users");
  }
});

export { registerUser, loginUser, refreshAccessToken, logoutUser, changePassword, googleAuthController, getUsers };
