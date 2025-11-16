import { Request, Response } from "express";
import { signUpSchema } from "../schemas/signUpSchema";
import db from "../db/db_connect";
import { users, refreshTokens, User, NewUser, RefreshToken } from "../models";
import { eq, sql } from "drizzle-orm";
import ApiError from "../utils/ApiError";
import { comparePassword, hashPassword } from "../utils/passwordUtils";
import ApiResponse from "../utils/ApiResponse";
import { loginSchema } from "../schemas/loginSchema";
import { forgotPasswordSchema, resetPasswordSchema } from "../schemas/resetPasswordSchema";
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
import { nanoid } from "nanoid";
import { passwordResets } from "../models";
import { addHours } from "date-fns";

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

    const { data, error } = await resend.emails.send({
      from: 'hello@wahtabla.com', // or your verified domain
      to: validatedData.email,
      subject: 'Welcome to Wah Tabla – Begin Your Musical Journey Today!',
      html: `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: hsl(240, 10%, 3.9%); padding: 30px; color: hsl(0, 0%, 98%);">
      <div style="max-width: 600px; margin: auto; background: hsl(240, 10%, 3.9%); border-radius: 12px; overflow: hidden; border: 1px solid hsl(0, 0%, 20%);">

        <!-- Logo -->
        <div style="text-align: center; padding: 30px 20px; border-bottom: 1px solid hsl(0, 0%, 15%);">
          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            <strong>Wah Tabla</strong>
          </p>
        </div>

        <!-- Greeting -->
        <div style="padding: 30px 25px;">
          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            Dear <strong>${validatedData.username || 'Student'}</strong>,
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            Welcome to <strong>Wahtabla</strong>! We are delighted to have you join our community of music learners and enthusiasts. Wahtabla is designed to help you master the art of Tabla — whether you are just starting or looking to refine your skills.
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            To get started, please visit our <a href="https://wahtabla.com/profile" style="color:hsl(35, 100%, 60%); text-decoration: underline;">Platform</a> and choose the program best suited to your level of experience:
          </p>

          <ul style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%); padding-left: 20px;">
            <li>🎵 <strong>Beginner Course:</strong> Perfect for those who are new to Tabla or Indian rhythm.</li>
            <li>🎶 <strong>Intermediate Course:</strong> Designed for students who already have a foundation and want to build performance-level proficiency.</li>
            <li>🥁 <strong>Advanced Course:</strong> For serious learners aspiring to perform or teach professionally.</li>
          </ul>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            Once you’ve selected your course, simply follow the prompts to complete your enrollment. You will receive instant access to your lessons and learning resources.
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            If you need help choosing the right level or have any questions, our support team is happy to assist — just write to us at <a href="mailto:hello@wahtabla.com" style="color:hsl(35, 100%, 60%); text-decoration: underline;">hello@wahtabla.com</a>.
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            We look forward to being part of your musical journey!<br/>
            Welcome aboard,<br/>
            <strong>Team Wah Tabla</strong>
          </p>

          <div style="text-align: center; margin-top: 30px;">
            <a href="https://wahtabla.com" 
              style="background: hsl(35, 100%, 60%); color: hsl(240, 10%, 3.9%);
              padding: 12px 30px; text-decoration: none; border-radius: 8px;
              font-weight: 600; font-size: 15px; letter-spacing: 0.5px;">
              Visit Wahtabla
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid hsl(0, 0%, 15%); padding: 20px; text-align: center; font-size: 13px; color: hsl(0, 0%, 70%);">
          © ${new Date().getFullYear()} Wahtabla — All Rights Reserved<br/>
          <a href="https://wahtabla.com" style="color: hsl(35, 100%, 60%); text-decoration: none;">www.wahtabla.com</a>
        </div>
      </div>
    </div>
  `
    });

    const { data: data2, error: error2 } = await resend.emails.send({
      from: 'hello@wahtabla.com', // your verified sender
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

    if (error || error2) {
      console.log("Email not sent", error, error2);
    }

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

const forgotPassword = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { email } = forgotPasswordSchema.parse(req.body);
    // find the user
    const user: User[] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    if (user.length === 0) {
      throw new ApiError(404, "User not found");
    }

    const token = nanoid(64)
    const expiresAt = addHours(new Date(), 1);

    await db.insert(passwordResets).values({
      userId: user[0].userId,
      token,
      expiresAt,
    });

    const resetLink = `https://wahtabla.com/auth/reset-password?token=${token}`;

    const { data, error } = await resend.emails.send({
      from: 'hello@wahtabla.com', // or your verified domain
      to: user[0].email,
      subject: 'Reset Your Wahtabla Password',
      html: `
  <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: hsl(240, 10%, 3.9%); padding: 30px; color: hsl(0, 0%, 98%);">
    <div style="max-width: 600px; margin: auto; background: hsl(240, 10%, 3.9%); border-radius: 12px; overflow: hidden; border: 1px solid hsl(0, 0%, 20%);">

      <!-- Logo -->
      <div style="text-align: center; padding: 30px 20px; border-bottom: 1px solid hsl(0, 0%, 15%);">
          <h2 style="margin: 0;">Wah Tabla</h2>
      </div>

      <!-- Greeting -->
      <div style="padding: 30px 25px;">
        <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
          Dear <strong>${user[0].username || 'Student'}</strong>,
        </p>

        <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
          We received a request to reset your password for your <strong>Wahtabla</strong> account. Click the button below to choose a new password:
        </p>

        <div style="text-align: center; margin: 30px 0;">
          <a href="${resetLink}" 
            style="background: hsl(35, 100%, 60%); color: hsl(240, 10%, 3.9%);
            padding: 12px 30px; text-decoration: none; border-radius: 8px;
            font-weight: 600; font-size: 15px; letter-spacing: 0.5px;">
            Reset Password
          </a>
        </div>

        <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
          If you did not request a password reset, you can safely ignore this email — your account is secure.
        </p>

        <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
          For any help, contact our support team at <a href="mailto:hello@wahtabla.com" style="color:hsl(35, 100%, 60%); text-decoration: underline;">hello@wahtabla.com</a>.
        </p>

        <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
          Happy learning,<br/>
          <strong>Team Wahtabla</strong>
        </p>
      </div>

      <!-- Footer -->
      <div style="border-top: 1px solid hsl(0, 0%, 15%); padding: 20px; text-align: center; font-size: 13px; color: hsl(0, 0%, 70%);">
        © ${new Date().getFullYear()} Wahtabla — All Rights Reserved<br/>
        <a href="https://wahtabla.com" style="color: hsl(35, 100%, 60%); text-decoration: none;">www.wahtabla.com</a>
      </div>

    </div>
  </div>
  `
    });

    if (error) {
      throw new ApiError(500, "Failed to send password reset email");
    }

    res.status(200).json(
      new ApiResponse(
        200,
        null,
        "Password reset link sent to your email."
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
    throw new ApiError(500, "An error occurred while resetting the password for user");
  }
});

const resetPassword = asyncHandler(async (req: Request, res: Response) => {
  try {
    const { token, newPassword } = resetPasswordSchema.parse(req.body);

    if (!token || !newPassword) {
      res.status(400).json({ error: "Token and new password are required" });
      return; // stop execution
    }

    const [resetEntry] = await db
      .select()
      .from(passwordResets)
      .where(eq(passwordResets.token, token));

    if (!resetEntry) {
      res.status(400).json({ error: "Invalid token" });
      return;
    }

    if (new Date(resetEntry.expiresAt) < new Date()) {
      res.status(400).json({ error: "Token expired" });
      return;
    }

    const hashedPassword = await hashPassword(newPassword);

    await db.update(users).set({ password: hashedPassword }).where(eq(users.userId, resetEntry.userId));
    await db.delete(passwordResets).where(eq(passwordResets.token, token));

    // ✅ Do NOT return anything
    res.status(200).json(
      new ApiResponse(
        200,
        null,
        "Password reset successful"
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

    throw new ApiError(500, "An error occurred while resetting the password for user");
  }
});

const sendTestEmail = asyncHandler(async (req: Request, res: Response) => {
  // get user details from frontend
  // validation - not empty
  // check if user exists: email
  // hash password
  // save user to db
  // check for user creation
  // send response
  try {
    const { data, error } = await resend.emails.send({
      from: 'hello@wahtabla.com', // or your verified domain
      to: 'jazzsarin28@gmail.com',
      subject: 'Welcome to Wah Tabla – Begin Your Musical Journey Today!',
      html: `
    <div style="font-family: 'Segoe UI', Helvetica, Arial, sans-serif; background: hsl(240, 10%, 3.9%); padding: 30px; color: hsl(0, 0%, 98%);">
      <div style="max-width: 600px; margin: auto; background: hsl(240, 10%, 3.9%); border-radius: 12px; overflow: hidden; border: 1px solid hsl(0, 0%, 20%);">

        <!-- Logo -->
        <div style="text-align: center; padding: 30px 20px; border-bottom: 1px solid hsl(0, 0%, 15%);">
          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            <strong>Wah Tabla</strong>
          </p>
        </div>

        <!-- Greeting -->
        <div style="padding: 30px 25px;">
          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            Dear <strong>Student</strong>,
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            Welcome to <strong>Wahtabla</strong>! We are delighted to have you join our community of music learners and enthusiasts. Wahtabla is designed to help you master the art of Tabla — whether you are just starting or looking to refine your skills.
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            To get started, please visit our <a href="https://wahtabla.com/profile" style="color:hsl(35, 100%, 60%); text-decoration: underline;">Platform</a> and choose the program best suited to your level of experience:
          </p>

          <ul style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%); padding-left: 20px;">
            <li>🎵 <strong>Beginner Course:</strong> Perfect for those who are new to Tabla or Indian rhythm.</li>
            <li>🎶 <strong>Intermediate Course:</strong> Designed for students who already have a foundation and want to build performance-level proficiency.</li>
            <li>🥁 <strong>Advanced Course:</strong> For serious learners aspiring to perform or teach professionally.</li>
          </ul>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            Once you’ve selected your course, simply follow the prompts to complete your enrollment. You will receive instant access to your lessons and learning resources.
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            If you need help choosing the right level or have any questions, our support team is happy to assist — just write to us at <a href="mailto:hello@wahtabla.com" style="color:hsl(35, 100%, 60%); text-decoration: underline;">hello@wahtabla.com</a>.
          </p>

          <p style="font-size: 16px; line-height: 1.7; color: hsl(0, 0%, 90%);">
            We look forward to being part of your musical journey!<br/>
            Welcome aboard,<br/>
            <strong>Team Wah Tabla</strong>
          </p>

          <div style="text-align: center; margin-top: 30px;">
            <a href="https://wahtabla.com" 
              style="background: hsl(35, 100%, 60%); color: hsl(240, 10%, 3.9%);
              padding: 12px 30px; text-decoration: none; border-radius: 8px;
              font-weight: 600; font-size: 15px; letter-spacing: 0.5px;">
              Visit Wahtabla
            </a>
          </div>
        </div>

        <!-- Footer -->
        <div style="border-top: 1px solid hsl(0, 0%, 15%); padding: 20px; text-align: center; font-size: 13px; color: hsl(0, 0%, 70%);">
          © ${new Date().getFullYear()} Wahtabla — All Rights Reserved<br/>
          <a href="https://wahtabla.com" style="color: hsl(35, 100%, 60%); text-decoration: none;">www.wahtabla.com</a>
        </div>
      </div>
    </div>
  `
    });

    if (error) {
      res.status(400).json({
        success: false,
        message: error,
      });
    }

    res
      .status(201)
      .json(
        new ApiResponse(
          200,
          "Email sent successfully"
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

export { registerUser, loginUser, refreshAccessToken, logoutUser, changePassword, googleAuthController, getUsers, forgotPassword, resetPassword, sendTestEmail };
