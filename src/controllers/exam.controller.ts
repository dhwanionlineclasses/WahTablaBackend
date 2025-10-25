// controllers/exam.controller.ts
import { Request, Response, NextFunction } from "express";
import z from "zod";
import db from "../db/db_connect";
import { eq, and, gte, lt } from "drizzle-orm";
import ApiError from "../utils/ApiError";
import ApiResponse from "../utils/ApiResponse";
import asyncHandler from "../utils/asyncHandler";
import { UserWithoutPassword } from "../@types/types";
import { resolveMultipleOrderItems } from '../utils/orderHelpers';
import { videoAnalyticsSchema } from "../schemas/videoAnalyticsSchema";
import { videoAnalytics, VideoAnalytics, NewVideoAnalytics } from "../models/videoAnalytics.model";


import {
  exams as examsTable,
  mcqQuestions,
  mcqOptions,
  examAttempts,
  assignmentSubmissions,
  courses,
  years,
  orders,
  entranceExams,
  entranceMcqQuestions,
  entranceMcqOptions,
  users
} from "../models";

import {
  getExamSchema,
  getEntranceExamSchema,
  submitMcqSchema,
  submitAssignmentSchema,
  submitFinalExamSchema
} from "../schemas/examSchema";

import {
  checkAssignmentReAttemptEligibility,
  getAssignmentQuestions,
  getFinalExamSections
} from './exam.helper.controller';

const getExam = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const userId = user?.userId;
  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }
  console.log('Fetching exam with userId:', userId);
  try {
    const { courseId, yearId, weekNumber, type } = getExamSchema.parse(req.query);

    const hasAccess = await checkUserAccess(userId, courseId, yearId);
    if (!hasAccess) {
      throw new ApiError(403, 'You do not have access to this exam');
    }

    const examResults = await db.select()
      .from(examsTable)
      .where(and(
        eq(examsTable.courseId, courseId),
        eq(examsTable.yearId, yearId),
        eq(examsTable.weekNumber, weekNumber),
        eq(examsTable.type, type as any)
      ))
      .limit(1);

    if (examResults.length === 0) {
      throw new ApiError(404, 'Exam not found');
    }

    const exam = examResults[0];

    const courseResults = await db.select({
      courseId: courses.courseId,
      courseName: courses.courseName
    })
      .from(courses)
      .where(eq(courses.courseId, courseId))
      .limit(1);

    const yearResults = await db.select({
      yearId: years.yearId,
      yearName: years.yearName
    })
      .from(years)
      .where(eq(years.yearId, yearId))
      .limit(1);

    const attemptsResults = await db.select()
      .from(examAttempts)
      .where(and(
        eq(examAttempts.examId, exam.examId),
        eq(examAttempts.userId, userId)
      ))
      .orderBy(examAttempts.submittedAt);

    const isUnlocked = await checkExamUnlocked(userId, exam.examId);
    if (!isUnlocked) {
      throw new ApiError(423, 'This exam is locked. Complete previous requirements first.');
    }

    const courseName = courseResults.length > 0 ? courseResults[0].courseName : '';
    const yearName = yearResults.length > 0 ? yearResults[0].yearName : '';

    const baseResponse = {
      examId: exam.examId,
      courseId: exam.courseId,
      courseName,
      yearName,
      weekNumber: exam.weekNumber,
      type: exam.type,
      title: exam.title,
      description: exam.description,
      isActive: exam.isActive,
      totalMarks: exam.totalMarks,
      attempts: attemptsResults.map(attempt => ({
        attemptId: attempt.attemptId,
        passed: attempt.passed,
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt
      }))
    };

    let response: any = { ...baseResponse };
    switch (type) {
      case 'mcq':
        const mcqQuestions = await getMcqQuestions(exam.examId);
        response.questions = mcqQuestions;
        break;

      case 'assignment':
        const assignmentQuestions = await getAssignmentQuestions(exam.examId);
        response.assignmentPrompt = exam.description;
        response.questions = assignmentQuestions;
        response.canResubmit = attemptsResults.length === 0 ||
          (attemptsResults.length > 0 &&
            attemptsResults[attemptsResults.length - 1].gradedAt &&
            !attemptsResults[attemptsResults.length - 1].passed);
        break;

      case 'final':
        const finalExamSections = await getFinalExamSections(exam.examId);
        response.sections = finalExamSections;
        response.submissionType = 'link';
        response.canResubmit = attemptsResults.length === 0 ||
          (attemptsResults.length > 0 &&
            attemptsResults[attemptsResults.length - 1].gradedAt &&
            !attemptsResults[attemptsResults.length - 1].passed);
        break;
    }

    res.status(200).json(
      new ApiResponse(200, response, 'Exam retrieved successfully')
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, error.errors[0].message);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'An error occurred while fetching exam');
  }
});

async function getMcqQuestions(examId: number) {
  const questionsResults = await db.select()
    .from(mcqQuestions)
    .where(eq(mcqQuestions.examId, examId))
    .orderBy(mcqQuestions.questionOrder);

  const questions = [];
  for (const question of questionsResults) {
    const optionsResults = await db.select({
      optionId: mcqOptions.optionId,
      optionText: mcqOptions.optionText,
      optionOrder: mcqOptions.optionOrder
    })
      .from(mcqOptions)
      .where(eq(mcqOptions.questionId, question.questionId))
      .orderBy(mcqOptions.optionOrder);

    questions.push({
      questionId: question.questionId,
      question: question.question,
      questionOrder: question.questionOrder,
      options: optionsResults
    });
  }
  return questions;
}


const getEntranceExam = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user;
  const userId = user?.userId;
  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }
  try {
    const { courseId } = getEntranceExamSchema.parse(req.query);

    const examResults = await db.select()
      .from(entranceExams)
      .where(and(
        eq(entranceExams.courseId, courseId)
      ))
      .limit(1);

    if (examResults.length === 0) {
      throw new ApiError(404, 'Exam not found');
    }

    const exam = examResults[0];

    const baseResponse = {
      examId: exam.examId,
      courseId: exam.courseId,
      title: exam.title,
      isActive: exam.isActive,
      totalMarks: exam.totalMarks,
    };

    let response: any = { ...baseResponse };
    const mcqQuestions = await getEntranceMcqQuestions(exam.examId);
    response.questions = mcqQuestions;

    res.status(200).json(
      new ApiResponse(200, response, 'Exam retrieved successfully')
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, error.errors[0].message);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'An error occurred while fetching exam');
  }
});

async function getEntranceMcqQuestions(examId: number) {
  const questionsResults = await db.select()
    .from(entranceMcqQuestions)
    .where(eq(entranceMcqQuestions.examId, examId))
    .orderBy(entranceMcqQuestions.questionOrder);

  const questions = [];
  for (const question of questionsResults) {
    const optionsResults = await db.select({
      optionId: entranceMcqOptions.optionId,
      optionText: entranceMcqOptions.optionText,
      optionOrder: entranceMcqOptions.optionOrder
    })
      .from(entranceMcqOptions)
      .where(eq(entranceMcqOptions.questionId, question.questionId))
      .orderBy(entranceMcqOptions.optionOrder);

    questions.push({
      questionId: question.questionId,
      question: question.question,
      questionOrder: question.questionOrder,
      options: optionsResults
    });
  }
  return questions;
}


const getCourseExams = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as UserWithoutPassword;
  const userId = user?.userId;
  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  try {
    const { courseId, yearId } = z.object({
      courseId: z.string().transform(Number),
      yearId: z.string().transform(Number)
    }).parse(req.params);


    const hasAccess = await checkUserAccess(userId, courseId, yearId);
    if (!hasAccess) {
      throw new ApiError(403, 'You do not have access to these exams');
    }

    const courseExamsResults = await db.select()
      .from(examsTable)
      .where(and(
        eq(examsTable.courseId, courseId),
        eq(examsTable.yearId, yearId)
      ))
      .orderBy(examsTable.weekNumber, examsTable.type);

    const examSummary = await Promise.all(courseExamsResults.map(async (exam) => {
      const attemptsResults = await db.select()
        .from(examAttempts)
        .where(and(
          eq(examAttempts.examId, exam.examId),
          eq(examAttempts.userId, userId)
        ))
        .orderBy(examAttempts.submittedAt);

      const isUnlocked = await checkExamUnlocked(userId, exam.examId);
      const latestAttempt = attemptsResults.length > 0 ? attemptsResults[attemptsResults.length - 1] : null;

      return {
        examId: exam.examId,
        weekNumber: exam.weekNumber,
        type: exam.type,
        title: exam.title,
        description: exam.description,
        isUnlocked,
        attemptCount: attemptsResults.length,
        passed: latestAttempt?.passed || false,
        lastAttemptDate: latestAttempt?.submittedAt || null,
        isGraded: latestAttempt?.gradedAt ? true : false
      };
    }));

    res.status(200).json(
      new ApiResponse(200, { exams: examSummary }, 'Course exams retrieved successfully')
    );
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, error.errors[0].message);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'An error occurred while fetching course exams');
  }
});


async function checkUserAccess(userId: number, courseId: number, yearId: number): Promise<boolean> {
  try {

    const userOrders = await db.select()
      .from(orders)
      .where(eq(orders.userId, userId));


    if (userOrders.length === 0) {
      return false;
    }

    const allOrderItems: any[] = [];
    for (const order of userOrders) {
      const orderItemsResults = await db.query.orderItems.findMany({
        where: (orderItems, { eq }) => eq(orderItems.orderId, order.orderId)
      });

      allOrderItems.push(...orderItemsResults);
    }


    const resolvedItems = await resolveMultipleOrderItems(allOrderItems);

    const hasAccess = resolvedItems.some(item => {

      if (item.courseId === courseId) {
        return true;
      }

      if (item.yearId === yearId) {
        return true;
      }

      return false;
    });

    if (!hasAccess) {
      const yearCourseResult = await db.select({ courseId: years.courseId })
        .from(years)
        .where(eq(years.yearId, yearId))
        .limit(1);

      if (yearCourseResult.length > 0) {
        const yearCourseId = yearCourseResult[0].courseId;

        const hasCourseAccess = resolvedItems.some(item => {
          if (item.courseId === yearCourseId) {
            return true;
          }
          return false;
        });

        if (hasCourseAccess) {
          return true;
        }
      }
    }

    return hasAccess;
  } catch (error) {
    return false;
  }
}


async function checkExamUnlocked(userId: number, examId: number): Promise<boolean> {
  try {
    const examResults = await db.select()
      .from(examsTable)
      .where(eq(examsTable.examId, examId))
      .limit(1);

    if (examResults.length === 0) return false;

    const currentExam = examResults[0];
    return true;
  } catch (error) {
    console.error('Error checking exam unlock status:', error);
    return false;
  }
}



//submit MCQ exam
//check if exam exists and is MCQ type
//get total questions from database
//validate response and calculate unanswered questions
//get existing attempt
//check if user has already passed this mcq
//check daily limit using attemptNumber and date
//increase attemptNumber and reset it on new day
//update attempt or create new attempt if it is first time
//calculate score and assign pass or fail and store in database
const submitMcqExam = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as UserWithoutPassword;
  const userId = user?.userId;
  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  try {
    const { examId, responses } = submitMcqSchema.parse(req.body);

    const examResults = await db.select()
      .from(examsTable)
      .where(eq(examsTable.examId, examId))
      .limit(1);

    if (!examResults.length || examResults[0].type !== 'mcq') {
      throw new ApiError(404, 'MCQ exam not found');
    }

    const examQuestions = await db.select()
      .from(mcqQuestions)
      .where(eq(mcqQuestions.examId, examId));

    if (examQuestions.length === 0) {
      throw new ApiError(404, 'No MCQ questions found for this exam. Please contact admin.');
    }

    const totalQuestionsInDB = examQuestions.length;

    if (!responses || responses.length === 0) {
      throw new ApiError(400, 'No responses provided');
    }

    const unansweredQuestions = totalQuestionsInDB - responses.length;

    const existingAttempt = await db.select()
      .from(examAttempts)
      .where(and(
        eq(examAttempts.userId, userId),
        eq(examAttempts.examId, examId)
      ))
      .limit(1);

    let attempt;
    let currentAttemptNumber;

    if (existingAttempt.length > 0) {
      if (existingAttempt[0].passed) {
        throw new ApiError(400, 'You have already passed this MCQ exam');
      }

      const today = new Date();
      const lastAttemptDate = new Date(existingAttempt[0].submittedAt!);
      const isToday = today.toDateString() === lastAttemptDate.toDateString();

      if (isToday && existingAttempt[0].attemptNumber >= 3) {
        throw new ApiError(429, `You have reached the daily limit of 3 attempts for this MCQ exam. You can try again tomorrow.`);
      }

      currentAttemptNumber = isToday ? existingAttempt[0].attemptNumber + 1 : 1;

      const [updatedAttempt] = await db.update(examAttempts)
        .set({
          attemptNumber: currentAttemptNumber,
          submittedAt: new Date(),
          passed: false,
          gradedAt: null,
          gradedBy: null
        })
        .where(eq(examAttempts.attemptId, existingAttempt[0].attemptId))
        .returning();

      attempt = updatedAttempt;
    } else {
      currentAttemptNumber = 1;

      const [newAttempt] = await db.insert(examAttempts)
        .values({
          examId,
          userId,
          attemptNumber: currentAttemptNumber,
          submittedAt: new Date()
        })
        .returning();

      attempt = newAttempt;
    }


    const questionIds = examQuestions.map(q => q.questionId);
    const submittedQuestionIds = responses.map(r => r.questionId);

    for (const submittedId of submittedQuestionIds) {
      if (!questionIds.includes(submittedId)) {
        throw new ApiError(400, `Question ID ${submittedId} does not exist for this exam`);
      }
    }

    let correctAnswers = 0;

    for (const response of responses) {
      const optionResults = await db.select()
        .from(mcqOptions)
        .where(eq(mcqOptions.optionId, response.selectedOptionId))
        .limit(1);

      if (optionResults.length === 0) {
        throw new ApiError(400, `Option ID ${response.selectedOptionId} does not exist for question ${response.questionId}`);
      }

      if (optionResults[0].isCorrect) {
        correctAnswers++;
      }
    }

    const percentage = Math.round((correctAnswers / totalQuestionsInDB) * 100);
    const passed = percentage >= 50;

    await db.update(examAttempts)
      .set({
        passed,
        gradedAt: new Date()
      })
      .where(eq(examAttempts.attemptId, attempt.attemptId));

    const remainingAttempts = passed ? 0 : Math.max(0, 3 - currentAttemptNumber);

    let message = '';
    if (passed) {
      message = `Congratulations! You passed with ${percentage}% (${correctAnswers}/${totalQuestionsInDB} correct)`;
    } else {
      if (remainingAttempts > 0) {
        message = `You scored ${percentage}% (${correctAnswers}/${totalQuestionsInDB} correct). You need at least 50% to pass. You have ${remainingAttempts} attempts remaining today.`;
      } else {
        message = `You scored ${percentage}% (${correctAnswers}/${totalQuestionsInDB} correct). You need at least 50% to pass. You have reached the daily limit. You can try again tomorrow.`;
      }
    }

    res.status(200).json(
      new ApiResponse(200, {
        attemptId: attempt.attemptId,
        examId,
        attemptNumber: currentAttemptNumber,
        totalQuestionsInExam: totalQuestionsInDB,
        questionsAnswered: responses.length,
        correctAnswers,
        incorrectAnswers: totalQuestionsInDB - correctAnswers,
        unansweredQuestions,
        percentage,
        passed,
        passThreshold: 50,
        remainingAttemptsToday: remainingAttempts,
        canRetakeToday: remainingAttempts > 0 && !passed,
        gradedAt: new Date(),
        message
      }, 'MCQ exam submitted and graded successfully')
    );

  } catch (error) {
    console.error('MCQ submission error:', error);

    if (error instanceof z.ZodError) {
      throw new ApiError(400, error.errors[0].message);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'An error occurred while submitting MCQ exam');
  }
});

const submitEntranceMcqExam = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as UserWithoutPassword;
  const userId = user?.userId;
  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  try {
    const { examId, responses } = submitMcqSchema.parse(req.body);

    const examResults = await db.select()
      .from(entranceExams)
      .where(eq(entranceExams.examId, examId))
      .limit(1);

    if (!examResults.length) {
      throw new ApiError(404, 'Entrance exam not found');
    }

    const examQuestions = await db.select()
      .from(entranceMcqQuestions)
      .where(eq(entranceMcqQuestions.examId, examId));

    if (examQuestions.length === 0) {
      throw new ApiError(404, 'No MCQ questions found for this exam. Please contact admin.');
    }

    const totalQuestionsInDB = examQuestions.length;

    if (!responses || responses.length === 0) {
      throw new ApiError(400, 'No responses provided');
    }

    const unansweredQuestions = totalQuestionsInDB - responses.length;

    const existingAttempt = await db.select()
      .from(examAttempts)
      .where(and(
        eq(examAttempts.userId, userId),
        eq(examAttempts.entranceExamId, examId)
      ))
      .limit(1);

    let attempt;
    let currentAttemptNumber;

    if (existingAttempt.length > 0) {
      if (existingAttempt[0].passed) {
        throw new ApiError(400, 'You have already passed this MCQ exam');
      }

      const today = new Date();
      const lastAttemptDate = new Date(existingAttempt[0].submittedAt!);
      const isToday = today.toDateString() === lastAttemptDate.toDateString();

      // if (isToday && existingAttempt[0].attemptNumber >= 3) {
      //   throw new ApiError(429, `You have reached the daily limit of 3 attempts for this MCQ exam. You can try again tomorrow.`);
      // }

      currentAttemptNumber = isToday ? existingAttempt[0].attemptNumber + 1 : 1;

      const [updatedAttempt] = await db.update(examAttempts)
        .set({
          attemptNumber: currentAttemptNumber,
          submittedAt: new Date(),
          passed: false,
          gradedAt: null,
          gradedBy: null
        })
        .where(eq(examAttempts.attemptId, existingAttempt[0].attemptId))
        .returning();

      attempt = updatedAttempt;
    } else {
      currentAttemptNumber = 1;

      const [newAttempt] = await db.insert(examAttempts)
        .values({
          examId,
          userId,
          attemptNumber: currentAttemptNumber,
          submittedAt: new Date()
        })
        .returning();

      attempt = newAttempt;
    }


    const questionIds = examQuestions.map(q => q.questionId);
    const submittedQuestionIds = responses.map(r => r.questionId);

    for (const submittedId of submittedQuestionIds) {
      if (!questionIds.includes(submittedId)) {
        throw new ApiError(400, `Question ID ${submittedId} does not exist for this exam`);
      }
    }

    let correctAnswers = 0;

    for (const response of responses) {
      const optionResults = await db.select()
        .from(entranceMcqOptions)
        .where(eq(entranceMcqOptions.optionId, response.selectedOptionId))
        .limit(1);

      if (optionResults.length === 0) {
        throw new ApiError(400, `Option ID ${response.selectedOptionId} does not exist for question ${response.questionId}`);
      }

      if (optionResults[0].isCorrect) {
        correctAnswers++;
      }
    }

    const percentage = Math.round((correctAnswers / totalQuestionsInDB) * 100);
    const passed = percentage >= 50;

    await db.update(examAttempts)
      .set({
        passed,
        gradedAt: new Date()
      })
      .where(eq(examAttempts.attemptId, attempt.attemptId));

    const remainingAttempts = passed ? 0 : Math.max(0, 3 - currentAttemptNumber);

    let message = '';
    if (passed) {
      message = `Congratulations! You passed with ${percentage}% (${correctAnswers}/${totalQuestionsInDB} correct)`;
    } else {
      if (remainingAttempts > 0) {
        message = `You scored ${percentage}% (${correctAnswers}/${totalQuestionsInDB} correct). You need at least 50% to pass. You have ${remainingAttempts} attempts remaining today.`;
      } else {
        message = `You scored ${percentage}% (${correctAnswers}/${totalQuestionsInDB} correct). You need at least 50% to pass. You have reached the daily limit. You can try again tomorrow.`;
      }
    }

    if (!passed) {
      if ('bibhusan'.includes(examResults[0].title.toLowerCase())) {
        await db.update(users)
        .set({
          bibhusanActive: true
        })
        .where(eq(users.userId, userId));
      } else if ('ratna'.includes(examResults[0].title.toLowerCase())) {
        await db.update(users)
          .set({
            ratnaActive: true
          })
          .where(eq(users.userId, userId));
      }
    }

    res.status(200).json(
      new ApiResponse(200, {
        attemptId: attempt.attemptId,
        examId,
        attemptNumber: currentAttemptNumber,
        totalQuestionsInExam: totalQuestionsInDB,
        questionsAnswered: responses.length,
        correctAnswers,
        incorrectAnswers: totalQuestionsInDB - correctAnswers,
        unansweredQuestions,
        percentage,
        passed,
        passThreshold: 50,
        remainingAttemptsToday: remainingAttempts,
        canRetakeToday: remainingAttempts > 0 && !passed,
        gradedAt: new Date(),
        message
      }, 'MCQ exam submitted and graded successfully')
    );

  } catch (error) {
    console.error('MCQ submission error:', error);

    if (error instanceof z.ZodError) {
      throw new ApiError(400, error.errors[0].message);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'An error occurred while submitting MCQ exam');
  }
});

//submit assignment exam
//Check if exam exists and is assignment type
//re-attempt logic
//Validate submissions and each submission has either text or link
//Get attempt number for response
//Create exam attempt and Save assignment submissions
const submitAssignmentExam = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as UserWithoutPassword;
  const userId = user?.userId;
  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  try {
    const { examId, submissions } = submitAssignmentSchema.parse(req.body);

    const examResults = await db.select()
      .from(examsTable)
      .where(eq(examsTable.examId, examId))
      .limit(1);

    if (!examResults.length || examResults[0].type !== 'assignment') {
      throw new ApiError(404, 'Assignment exam not found');
    }

    const { canAttempt, reason } = await checkAssignmentReAttemptEligibility(userId, examId);
    if (!canAttempt) {
      throw new ApiError(400, reason || 'Cannot re-attempt this assignment');
    }

    if (!submissions || submissions.length === 0) {
      throw new ApiError(400, 'No submissions provided');
    }

    for (const submission of submissions) {
      if (submission.submissionType === 'text' && !submission.textAnswer) {
        throw new ApiError(400, 'Text answer is required for text submissions');
      }
      if (submission.submissionType === 'link' && !submission.linkUrl) {
        throw new ApiError(400, 'Link URL is required for link submissions');
      }
    }

    const existingAttempts = await db.select()
      .from(examAttempts)
      .where(and(
        eq(examAttempts.userId, userId),
        eq(examAttempts.examId, examId)
      ));

    let analytics: VideoAnalytics[] = []
    if (existingAttempts.length <= 0) {
      const exam = await db.select().from(examsTable).where(eq(examsTable.examId, examId)).limit(1)

      const courseId = exam[0].courseId
      const yearId = exam[0].yearId

      const userOrders = await db.query.orders.findMany({
        where: (orders, { eq }) => eq(orders.userId, userId),
        with: {
          orderItems: {
            columns: { itemType: true },
            with: {
              course: {
                columns: { courseId: true, courseName: true },
                with: {
                  years: {
                    columns: { yearId: true, yearName: true },
                    with: {
                      modules: {
                        columns: { moduleId: true, moduleName: true },
                        with: {
                          months: {
                            columns: { monthId: true, monthName: true },
                            with: {
                              videos: {
                                columns: {
                                  videoId: true,
                                  videoVimeoId: true,
                                  videoTitle: true,
                                  videoUrl: true,
                                  description: true,
                                  duration: true,
                                  thumbnailUrl: true
                                }
                              },
                            }
                          }
                        }
                      },
                      exams: {
                        columns: {
                          examId: true,
                          weekNumber: true,
                          type: true,
                          isActive: true,
                          yearId: true
                        }
                      }
                    }
                  },
                  exams: {
                    columns: {
                      examId: true,
                      weekNumber: true,
                      type: true,
                      isActive: true,
                      yearId: true

                    }
                  }
                }
              },
              year: {
                columns: { yearId: true, yearName: true },
                with: {
                  modules: {
                    columns: { moduleId: true, moduleName: true },
                    with: {
                      months: {
                        columns: { monthId: true, monthName: true },
                        with: {
                          videos: {
                            columns: {
                              videoId: true,
                              videoVimeoId: true,
                              videoTitle: true,
                              videoUrl: true,
                              description: true,
                              duration: true,
                              thumbnailUrl: true
                            }
                          },
                        }
                      },
                    }
                  },
                  course: { columns: { courseId: true, courseName: true } },
                  exams: {
                    columns: {
                      examId: true,
                      weekNumber: true,
                      type: true,
                      isActive: true,
                      yearId: true

                    }
                  }
                }
              },
              module: {
                columns: { moduleId: true, moduleName: true },
                with: {
                  months: {
                    columns: { monthId: true, monthName: true },
                    with: {
                      videos: {
                        columns: {
                          videoId: true,
                          videoVimeoId: true,
                          videoTitle: true,
                          videoUrl: true,
                          description: true,
                          duration: true,
                          thumbnailUrl: true
                        }
                      },
                    }
                  },
                  year: { columns: { yearId: true, yearName: true } },
                  course: { columns: { courseId: true, courseName: true } },
                }
              },
              month: {
                columns: { monthId: true, monthName: true },
                with: {
                  videos: {
                    columns: {
                      videoId: true,
                      videoVimeoId: true,
                      videoTitle: true,
                      videoUrl: true,
                      description: true,
                      duration: true,
                      thumbnailUrl: true
                    }
                  },
                  module: { columns: { moduleId: true, moduleName: true } },
                  year: { columns: { yearId: true, yearName: true } },
                  course: { columns: { courseId: true, courseName: true } }
                }
              }
            }
          }
        }
      });

      // existing logic to build purchasedDetails and startingVideos
      const purchasedDetails: { [key: string]: any } = {};

      function getStartingVideo(item: any, type: string) {
        const findWeekOneVideo = (videos: any[]) => {
          if (!videos || videos.length === 0) return null;
          const weekOne = videos.find((v) =>
            v.videoTitle?.toLowerCase().includes("week 1")
          );
          return weekOne || videos[0];
        };

        if (type === "Course") {
          const year = item?.years?.[0];
          const module = year?.modules?.[0];
          const month = module?.months?.[0];
          const video = findWeekOneVideo(month?.videos || []);
          return video ? { courseId: item.courseId, moduleId: module.moduleId, monthId: month.monthId, video } : null;
        }

        if (type === "Year") {
          const module = item?.modules?.[0];
          const month = module?.months?.[0];
          const video = findWeekOneVideo(month?.videos || []);
          return video ? { courseId: item.course.courseId, moduleId: module.moduleId, monthId: month.monthId, video } : null;
        }

        if (type === "Module") {
          const month = item?.months?.[0];
          const video = findWeekOneVideo(month?.videos || []);
          return video ? { courseId: item.course.courseId, moduleId: item.moduleId, monthId: month.monthId, video } : null;
        }

        if (type === "Month") {
          const video = findWeekOneVideo(item?.videos || []);
          return video ? { courseId: item.course.courseId, moduleId: item.module.moduleId, monthId: item.monthId, video } : null;
        }

        return null;
      }

      const startingVideos: any[] = [];

      // iterate over orders and orderItems
      userOrders.forEach(order => {
        order.orderItems.forEach(item => {
          const addExams = (obj: any, exams: any[]) => {
            if (exams?.length) obj.exams = exams.map(e => ({
              examId: e.examId,
              examName: e.examName,
              totalMarks: e.totalMarks,
              passingMarks: e.passingMarks
            }));
          };

          switch (item.itemType) {
            case "Course":
              const course = item.course;
              if (course) {
                const courseData = {
                  courseName: course.courseName,
                  years: course.years.map((year: any) => ({
                    yearId: year.yearId,
                    yearName: year.yearName,
                    modules: year.modules.map((module: any) => ({
                      moduleId: module.moduleId,
                      moduleName: module.moduleName,
                      months: module.months.map((month: any) => ({
                        monthId: month.monthId,
                        monthName: month.monthName,
                        videos: month.videos,
                        exams: month.exams,
                      })),
                      exams: module.exams
                    })),
                    exams: year.exams
                  })),
                  exams: course.exams
                };

                purchasedDetails[course.courseId] = courseData;
                const startVid = getStartingVideo(course, "Course");
                if (startVid) startingVideos.push(startVid);
              }
              break;
            case "Year":
            case "Module":
            case "Month":
              // same pattern: build hierarchy and attach exams at each level
              // ... you can replicate the same mapping logic and attach exams like above
              break;

            default:
              console.warn("Unknown item type:", item.itemType);
          }
        });
      });

      var allVideos: any[] = []
      const yearDetails = purchasedDetails[courseId].years.find((y: any) => y.yearId == yearId)
      yearDetails.modules.map((module: any) => {
        module.months.map((month: any) => {
          month.videos.map((video: any) => {
            allVideos.push(video)
          })
        })
      })

      function getWeekNumberFromTitle(title: string): number | null {
        const match = title.match(/\d+/); // extract first number
        return match ? parseInt(match[0], 10) : null;
      }

      function findNextVideoAfterExam(videos: any[], exam: any): any | null {
        const examWeek = exam.weekNumber;
        const nextWeek = examWeek + 1;

        // find video whose week number matches nextWeek
        const nextVideo = videos.find(
          (v) => getWeekNumberFromTitle(v.videoTitle) === nextWeek
        );

        return nextVideo || null;
      }

      const nextVideo = findNextVideoAfterExam(allVideos, exam[0]);

      if (nextVideo) {
        const existing = await db
          .select()
          .from(videoAnalytics)
          .where(
            and(eq(videoAnalytics.userId, userId), eq(videoAnalytics.videoId, nextVideo.videoId))
          )
          .limit(1);

        if (!existing.length) {
          const validated = videoAnalyticsSchema.parse({
            userId,
            videoId: nextVideo.videoId,
            videoName: nextVideo.videoTitle,
            playCount: 0,
            pauseCount: 0,
            seekCount: 0,
            watchedSeconds: 0,
            totalVideoDuration: Math.round(nextVideo.duration / 60),
            startDate: new Date(),
            endDate: new Date(),
            durationSeconds: nextVideo.duration,
            watchProgress: 0,
            fullyWatched: false,
            isExam: false,
            examId: null,
            yearId: yearId,
            courseId: courseId
          });

          await db.insert(videoAnalytics).values(validated);
        }
      }
      analytics = await db
        .select()
        .from(videoAnalytics)
        .where(eq(videoAnalytics.userId, Number(userId)));
    }

    const attemptNumber = existingAttempts.length + 1;

    const [attempt] = await db.insert(examAttempts)
      .values({
        examId,
        userId,
        submittedAt: new Date()
      })
      .returning();

    for (const submission of submissions) {
      await db.insert(assignmentSubmissions)
        .values({
          examId,
          userId,
          attemptId: attempt.attemptId,
          questionId: submission.questionId,
          submissionType: submission.submissionType,
          textAnswer: submission.textAnswer,
          linkUrl: submission.linkUrl,
          notes: submission.notes,
          submittedAt: new Date()
        });
    }

    res.status(200).json(
      new ApiResponse(200, {
        attemptId: attempt.attemptId,
        examId,
        attemptNumber,
        submissionsCount: submissions.length,
        submittedAt: new Date(),
        status: 'submitted',
        message: `Assignment submitted successfully (Attempt #${attemptNumber}). Your submission is now awaiting teacher review.`,
        videoAnalytics: analytics
      }, 'Assignment exam submitted successfully')
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, error.errors[0].message);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'An error occurred while submitting assignment');
  }
});

//submit final exam
// Check if exam exists and is final type
// Check if user already submitted this exam
// Create exam attempt
// Save final exam submission
// Send success response
const submitFinalExam = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
  const user = req.user as UserWithoutPassword;
  const userId = user?.userId;
  if (!userId) {
    throw new ApiError(401, 'User not authenticated');
  }

  try {
    const { examId, linkUrl, notes } = submitFinalExamSchema.parse(req.body);

    const examResults = await db.select()
      .from(examsTable)
      .where(eq(examsTable.examId, examId))
      .limit(1);

    const relatedExam = await db.query.exams.findFirst({
      where: (exam, { eq }) => eq(exam.examId, examId),
      columns: {
        examId: true,
        totalMarks: true,
        title: true,
        yearId: true // <-- add this
      },
      with: {
        course: {
          columns: { courseId: true, courseName: true },
          with: {
            years: {
              columns: { yearId: true, yearName: true },
              with: {
                modules: {
                  columns: { moduleId: true, moduleName: true },
                  with: {
                    months: {
                      columns: { monthId: true, monthName: true },
                      with: {
                        videos: {
                          columns: {
                            videoId: true,
                            videoTitle: true,
                            videoUrl: true,
                            duration: true,
                            thumbnailUrl: true
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    });

    const exam = relatedExam; // single exam object from findFirst
    const examYearId = exam?.yearId; // the year this exam is for
    const course = exam?.course;

    // let nextVideo = null;
    // let lastYearFlag = false;
    // let analytics: VideoAnalytics[] = [];

    // if (course?.years?.length) {
    //   // Sort years to ensure correct order
    //   const sortedYears = course.years.sort((a, b) => a.yearId - b.yearId);

    //   // Find the index of the exam year
    //   const examYearIndex = sortedYears.findIndex(year => year.yearId === examYearId);

    //   if (examYearIndex === -1) {
    //     throw new Error("Exam year not found in course data");
    //   }

    //   const isLastYear = examYearIndex === sortedYears.length - 1;

    //   if (isLastYear) {
    //     lastYearFlag = true; // No next video
    //   } else {
    //     // Next year after exam
    //     const nextYear = sortedYears[examYearIndex + 1];

    //     if (nextYear.modules?.length) {
    //       const firstModule = nextYear.modules[0];
    //       if (firstModule.months?.length) {
    //         const firstMonth = firstModule.months[0];

    //         if (firstMonth.videos?.length) {
    //           // Sort videos by week number extracted from videoTitle
    //           const getWeekNumber = (title: string) => {
    //             const match = title.match(/week\s*(\d+)/i);
    //             return match ? parseInt(match[1], 10) : Infinity; // unknown titles go last
    //           };

    //           const sortedVideos = firstMonth.videos
    //             .slice() // copy to avoid mutating original
    //             .sort((a, b) => getWeekNumber(a.videoTitle) - getWeekNumber(b.videoTitle));

    //           nextVideo = sortedVideos[0] ?? null; // pick week 1 video
    //         }
    //       }
    //     }
    //   }
    // }


    // console.log({ nextVideo, lastYearFlag });

    // if (nextVideo && !lastYearFlag) {
    //   const exisitingAnalytics = await db
    //     .select()
    //     .from(videoAnalytics)
    //     .where(eq(videoAnalytics.userId, Number(userId)));

    //   const analyticsExists = exisitingAnalytics.find(va => va.videoId === nextVideo?.videoId);

    //   if (!analyticsExists) {
    //     const data = {
    //       userId,
    //       videoId: nextVideo.videoId,
    //       videoName: nextVideo.videoTitle,
    //       playCount: 0,
    //       pauseCount: 0,
    //       seekCount: 0,
    //       watchedSeconds: 0,
    //       totalVideoDuration: Math.round((nextVideo?.duration ?? 0) / 60),
    //       startDate: new Date(),
    //       endDate: new Date(), // will be updated when user actually finishes
    //       durationSeconds: nextVideo?.duration ?? 0,
    //       watchProgress: 0,
    //       fullyWatched: false,
    //     }

    //     const validated = videoAnalyticsSchema.parse(data);

    //     await db.insert(videoAnalytics).values(validated);
    //     console.log(`Inserted video ${nextVideo.videoId} for user ${userId}`);

    //     analytics = await db
    //       .select()
    //       .from(videoAnalytics)
    //       .where(eq(videoAnalytics.userId, Number(userId)));
    //   } else {
    //     analytics = exisitingAnalytics;
    //   }
    // }


    // res.status(200).json(
    //   new ApiResponse(200, {
    //     videoAnalytics: analytics
    //   }, 'Final exam submitted successfully')
    // );


    // // throw new ApiError(404, 'Final exam not found');


    if (!examResults.length || examResults[0].type !== 'final') {
      throw new ApiError(404, 'Final exam not found');
    }

    const existingAttempt = await db.select()
      .from(examAttempts)
      .where(and(
        eq(examAttempts.examId, examId),
        eq(examAttempts.userId, userId)
      ))
      .limit(1);

    if (existingAttempt.length > 0) {
      throw new ApiError(400, 'You have already submitted this final exam. Re-attempts are not allowed for final exams.');
    }

    const [attempt] = await db.insert(examAttempts)
      .values({
        examId,
        userId,
        submittedAt: new Date()
      })
      .returning();

    await db.insert(assignmentSubmissions)
      .values({
        examId,
        userId,
        attemptId: attempt.attemptId,
        submissionType: 'link',
        linkUrl,
        notes,
        submittedAt: new Date()
      })

    res.status(200).json(
      new ApiResponse(200, {
        attemptId: attempt.attemptId,
        examId,
        linkUrl,
        submittedAt: new Date(),
        status: 'submitted',
        totalMarks: examResults[0].totalMarks,
        message: 'Final exam submitted successfully. Your submission is now awaiting teacher grading. Note: Re-attempts are not allowed for final exams.',
        // videoAnalytics: analytics
      }, 'Final exam submitted successfully')
    );

  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new ApiError(400, error.errors[0].message);
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(500, 'An error occurred while submitting final exam');
  }
});

export {
  getExam,
  getCourseExams,
  submitMcqExam,
  submitAssignmentExam,
  submitFinalExam,
  getEntranceExam,
  submitEntranceMcqExam
};
