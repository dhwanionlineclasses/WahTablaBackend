import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import userRouter from './routes/user.routes';
import { Express } from 'express';
import userProfileRouter from './routes/profile.routes';
import paymentRouter from './routes/payment.routes';
import adminRoutes from './routes/admin.routes';
import examRoutes from './routes/exam.routes';
import analyticsRoute from './routes/analytics.route';


const app: Express = express();

app.use(cors({
    origin: '*', 
    credentials: true,
}));

app.use((req, res, next) => {
  if (req.originalUrl.includes('/webhook')) {
    next();
  } else {
    express.json({ limit: '16kb' })(req, res, next);
  }
});
app.use(express.urlencoded({ extended: true, limit: "16kb" }));
app.use(express.static("public"));
app.use(cookieParser());
app.get("/api/hello", (req:Request, res:Response) => {
    res.json("Welcome to the API");
});
app.use("/api/v1/users", userRouter);
app.use("/api/v1/profiles", userProfileRouter);
app.use("/api/v1", paymentRouter);
app.use("/api/v1/admin", adminRoutes);
app.use('/api/v1/exams', examRoutes);
app.use('/api/v1/analytics', analyticsRoute);

export default app;
