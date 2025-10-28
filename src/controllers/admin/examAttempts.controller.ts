// controllers/admin/examAttempts.controller.ts
import { Request, Response } from 'express';
import db from '../../db/db_connect';
import { examAttempts, entranceExamAttempts, entranceExams, exams, courses, years, users, userProfiles, assignmentSubmissions, assignmentQuestions, certificates, orders, videoAnalytics } from '../../models';
import { videoAnalyticsSchema } from '../../schemas/videoAnalyticsSchema';
import { eq, desc, and, isNull, ne } from 'drizzle-orm';
import { AdminWithoutPassword } from '../../@types/admin.types';

const VALID_EXAM_TYPES = ['mcq', 'assignment', 'final'] as const;
type ExamType = typeof VALID_EXAM_TYPES[number];

interface AdminRequest extends Request {
  admin?: AdminWithoutPassword;
}

function isValidExamType(value: string): value is ExamType {
  return VALID_EXAM_TYPES.includes(value as ExamType);
}

export const getExamAttemptsForReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      examType,
      courseId,
      yearId,
      status = 'all',
      page = 1,
      limit = 1000
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const whereConditions = [];
    whereConditions.push(ne(exams.type, 'mcq'));
    if (examType) {
      if (typeof examType === 'string' && isValidExamType(examType)) {
        whereConditions.push(eq(exams.type, examType));
      } else {
        res.status(400).json({
          success: false,
          message: `Invalid exam type. Must be one of: ${VALID_EXAM_TYPES.join(', ')}`
        });
        return;
      }
    }


    if (courseId) {
      const courseIdNum = Number(courseId);
      if (isNaN(courseIdNum)) {
        res.status(400).json({
          success: false,
          message: 'Invalid course ID'
        });
        return;
      }
      whereConditions.push(eq(exams.courseId, courseIdNum));
    }

    if (yearId) {
      const yearIdNum = Number(yearId);
      if (isNaN(yearIdNum)) {
        res.status(400).json({
          success: false,
          message: 'Invalid year ID'
        });
        return;
      }
      whereConditions.push(eq(exams.yearId, yearIdNum));
    }

    if (status === 'pending') {
      whereConditions.push(isNull(examAttempts.gradedAt));
    } else if (status === 'graded') {
      whereConditions.push(isNull(examAttempts.gradedAt));
    }

    const examAttemptsData = await db
      .select({
        attemptId: examAttempts.attemptId,
        attemptNumber: examAttempts.attemptNumber,
        passed: examAttempts.passed,
        submittedAt: examAttempts.submittedAt,
        gradedAt: examAttempts.gradedAt,
        gradedBy: examAttempts.gradedBy,

        examId: exams.examId,
        examType: exams.type,
        examTitle: exams.title,
        examDescription: exams.description,
        weekNumber: exams.weekNumber,
        totalMarks: exams.totalMarks,

        courseId: courses.courseId,
        courseName: courses.courseName,
        yearId: years.yearId,
        yearName: years.yearName,

        userId: users.userId,
        username: users.username,
        email: users.email,
        fullName: userProfiles.fullName,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.examId))
      .innerJoin(courses, eq(exams.courseId, courses.courseId))
      .innerJoin(years, eq(exams.yearId, years.yearId))
      .innerJoin(users, eq(examAttempts.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(...whereConditions))
      .orderBy(desc(examAttempts.submittedAt))
      .limit(Number(limit))
      .offset(offset);

    const detailedAttempts = await Promise.all(
      examAttemptsData.map(async (attempt) => {
        const baseAttempt = {
          attemptId: attempt.attemptId,
          examId: attempt.examId,
          examType: attempt.examType,
          examTitle: attempt.examTitle,
          examDescription: attempt.examDescription,
          course: attempt.courseName,
          year: attempt.yearName,
          week: attempt.weekNumber,
          attemptNumber: attempt.attemptNumber,
          dateTime: attempt.submittedAt,
          userId: attempt.userId,
          username: attempt.username,
          fullName: attempt.fullName || 'N/A',
          email: attempt.email,
          status: attempt.passed === null ? 'pending' : (attempt.passed ? 'passed' : 'failed'),
          gradedAt: attempt.gradedAt,
          gradedBy: attempt.gradedBy,
          totalMarks: attempt.totalMarks,
        };


        if (attempt.examType === 'assignment') {
          const submissions = await db
            .select({
              submissionId: assignmentSubmissions.submissionId,
              questionId: assignmentSubmissions.questionId,
              submissionType: assignmentSubmissions.submissionType,
              textAnswer: assignmentSubmissions.textAnswer,
              linkUrl: assignmentSubmissions.linkUrl,
              notes: assignmentSubmissions.notes,
              isChecked: assignmentSubmissions.isChecked,
              passed: assignmentSubmissions.passed,
              feedback: assignmentSubmissions.feedback,
              question: assignmentQuestions.question,
              questionOrder: assignmentQuestions.questionOrder,
            })
            .from(assignmentSubmissions)
            .leftJoin(assignmentQuestions, eq(assignmentSubmissions.questionId, assignmentQuestions.questionId))
            .where(eq(assignmentSubmissions.attemptId, attempt.attemptId))
            .orderBy(assignmentQuestions.questionOrder);

          const assignmentDetails = submissions.map(sub => ({
            submissionId: sub.submissionId,
            questionId: sub.questionId,
            question: sub.question,
            questionOrder: sub.questionOrder,
            submissionType: sub.submissionType,
            textAnswer: sub.textAnswer,
            linkUrl: sub.linkUrl,
            notes: sub.notes,
            isChecked: sub.isChecked,
            passed: sub.passed,
            feedback: sub.feedback,
          }));

          return {
            ...baseAttempt,
            assignmentDetails
          };
        }

        if (attempt.examType === 'final') {
          const finalExamDetails = await getFinalExamDetails(attempt.attemptId);
          return {
            ...baseAttempt,
            finalExamDetails
          };
        }

        return baseAttempt;
      })
    );

    const totalCountResult = await db
      .select({ count: examAttempts.attemptId })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.examId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    res.status(200).json({
      success: true,
      data: detailedAttempts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCountResult.length,
        totalPages: Math.ceil(totalCountResult.length / Number(limit))
      },
      message: 'Exam attempts retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching exam attempts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const getEntranceExamAttemptsForReview = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      examType,
      courseId,
      yearId,
      status = 'all',
      page = 1,
      limit = 1000
    } = req.query;

    const offset = (Number(page) - 1) * Number(limit);

    const whereConditions = [];

    if (courseId) {
      const courseIdNum = Number(courseId);
      if (isNaN(courseIdNum)) {
        res.status(400).json({
          success: false,
          message: 'Invalid course ID'
        });
        return;
      }
      whereConditions.push(eq(entranceExams.courseId, courseIdNum));
    }

    if (status === 'pending') {
      whereConditions.push(isNull(entranceExamAttempts.gradedAt));
    } else if (status === 'graded') {
      whereConditions.push(isNull(entranceExamAttempts.gradedAt));
    }

    const examAttemptsData = await db
      .select({
        attemptId: entranceExamAttempts.attemptId,
        attemptNumber: entranceExamAttempts.attemptNumber,
        passed: entranceExamAttempts.passed,
        submittedAt: entranceExamAttempts.submittedAt,
        gradedAt: entranceExamAttempts.gradedAt,
        gradedBy: entranceExamAttempts.gradedBy,
        videoUrl: entranceExamAttempts.videoUrl,
        mcqPassed: entranceExamAttempts.mcqPassed,

        examId: entranceExams.examId,
        examTitle: entranceExams.title,
        totalMarks: entranceExams.totalMarks,

        courseId: courses.courseId,
        courseName: courses.courseName,

        userId: users.userId,
        username: users.username,
        email: users.email,
        fullName: userProfiles.fullName,
      })
      .from(entranceExamAttempts)
      .innerJoin(entranceExams, eq(entranceExamAttempts.entranceExamId, entranceExams.examId))
      .innerJoin(courses, eq(entranceExams.courseId, courses.courseId))
      .innerJoin(users, eq(entranceExamAttempts.userId, users.userId))
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(and(...whereConditions))
      .orderBy(desc(entranceExamAttempts.submittedAt))
      .limit(Number(limit))
      .offset(offset);

    const detailedAttempts = await Promise.all(
      examAttemptsData.map(async (attempt) => {
        const baseAttempt = {
          attemptId: attempt.attemptId,
          examId: attempt.examId,
          examTitle: attempt.examTitle,
          course: attempt.courseName,
          year: "N/A",
          attemptNumber: attempt.attemptNumber,
          dateTime: attempt.submittedAt,
          userId: attempt.userId,
          username: attempt.username,
          fullName: attempt.fullName || 'N/A',
          email: attempt.email,
          status: attempt.passed === null ? 'pending' : (attempt.passed ? 'passed' : 'failed'),
          gradedAt: attempt.gradedAt,
          gradedBy: attempt.gradedBy,
          totalMarks: attempt.totalMarks,
          videoUrl: attempt.videoUrl,
          mcqPassed: attempt.mcqPassed,
        }

        return baseAttempt;
      })
    );

    const totalCountResult = await db
      .select({ count: entranceExamAttempts.attemptId })
      .from(entranceExamAttempts)
      .innerJoin(entranceExams, eq(entranceExamAttempts.entranceExamId, entranceExams.examId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    res.status(200).json({
      success: true,
      data: detailedAttempts,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: totalCountResult.length,
        totalPages: Math.ceil(totalCountResult.length / Number(limit))
      },
      message: 'Exam attempts retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching exam attempts:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

async function getAssignmentDetails(attemptId: number) {
  const submissions = await db
    .select({
      submissionId: assignmentSubmissions.submissionId,
      questionId: assignmentSubmissions.questionId,
      submissionType: assignmentSubmissions.submissionType,
      textAnswer: assignmentSubmissions.textAnswer,
      linkUrl: assignmentSubmissions.linkUrl,
      notes: assignmentSubmissions.notes,
      isChecked: assignmentSubmissions.isChecked,
      passed: assignmentSubmissions.passed,
      feedback: assignmentSubmissions.feedback,
      question: assignmentQuestions.question,
      questionOrder: assignmentQuestions.questionOrder,
    })
    .from(assignmentSubmissions)
    .leftJoin(assignmentQuestions, eq(assignmentSubmissions.questionId, assignmentQuestions.questionId))
    .where(eq(assignmentSubmissions.attemptId, attemptId))
    .orderBy(assignmentQuestions.questionOrder);

  return {
    submissions: submissions.map(sub => ({
      submissionId: sub.submissionId,
      questionId: sub.questionId,
      question: sub.question,
      questionOrder: sub.questionOrder,
      submissionType: sub.submissionType,
      textAnswer: sub.textAnswer,
      linkUrl: sub.linkUrl,
      notes: sub.notes,
      isChecked: sub.isChecked,
      passed: sub.passed,
      feedback: sub.feedback,
    }))
  };
}

async function getFinalExamDetails(attemptId: number) {
  const submission = await db
    .select({
      submissionId: assignmentSubmissions.submissionId,
      submissionType: assignmentSubmissions.submissionType,
      linkUrl: assignmentSubmissions.linkUrl,
      notes: assignmentSubmissions.notes,
      totalMarks: assignmentSubmissions.totalMarks,
      isChecked: assignmentSubmissions.isChecked,
      passed: assignmentSubmissions.passed,
      feedback: assignmentSubmissions.feedback,
    })
    .from(assignmentSubmissions)
    .where(eq(assignmentSubmissions.attemptId, attemptId))
    .limit(1);

  const submissionData = submission[0];

  return {
    submissionId: submissionData?.submissionId || null,
    submissionType: submissionData?.submissionType || null,
    linkUrl: submissionData?.linkUrl || null,
    notes: submissionData?.notes || null,
    totalMarks: submissionData?.totalMarks || null,
    isChecked: submissionData?.isChecked || false,
    passed: submissionData?.passed || null,
    feedback: submissionData?.feedback || null,
    requiresCertificate: true,
  };
}


export const updateExamAttempt = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { passed, feedback, marks, attemptId } = req.body;

    if (typeof passed !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'Pass/fail status (passed) is required and must be boolean'
      });
      return;
    }

    const adminId = req.admin?.adminId;
    if (!adminId) {
      res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
      return;
    }

    const attemptIdNum = Number(attemptId);
    if (isNaN(attemptIdNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid attempt ID'
      });
      return;
    }

    const attemptData = await db
      .select({
        attemptId: examAttempts.attemptId,
        examId: examAttempts.examId,
        userId: examAttempts.userId,
        examType: exams.type,
        passed: examAttempts.passed,
        gradedAt: examAttempts.gradedAt,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.examId))
      .where(eq(examAttempts.attemptId, attemptIdNum))
      .limit(1);

    if (attemptData.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Exam attempt not found'
      });
      return;
    }

    const attempt = attemptData[0];
    if (attempt.gradedAt) {
      res.status(400).json({
        success: false,
        message: 'This exam attempt has already been graded'
      });
      return;
    }

    const exam = await db.select().from(exams).where(eq(exams.examId, attempt.examId)).limit(1)

    const courseId = exam[0].courseId
    const yearId = exam[0].yearId
    const userId = attempt.userId

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

    // if (attempt.examType === 'assignment' && passed) {
    //   var allVideos: any[] = []
    //   const yearDetails = purchasedDetails[courseId].years.find((y: any) => y.yearId == yearId)
    //   yearDetails.modules.map((module: any) => {
    //     module.months.map((month: any) => {
    //       month.videos.map((video: any) => {
    //         allVideos.push(video)
    //       })
    //     })
    //   })

    //   function getWeekNumberFromTitle(title: string): number | null {
    //     const match = title.match(/\d+/); // extract first number
    //     return match ? parseInt(match[0], 10) : null;
    //   }

    //   function findNextVideoAfterExam(videos: any[], exam: any): any | null {
    //     const examWeek = exam.weekNumber;
    //     const nextWeek = examWeek + 1;

    //     // find video whose week number matches nextWeek
    //     const nextVideo = videos.find(
    //       (v) => getWeekNumberFromTitle(v.videoTitle) === nextWeek
    //     );

    //     return nextVideo || null;
    //   }

    //   const nextVideo = findNextVideoAfterExam(allVideos, exam[0]);

    //   if (nextVideo) {
    //     const existing = await db
    //       .select()
    //       .from(videoAnalytics)
    //       .where(
    //         and(eq(videoAnalytics.userId, userId), eq(videoAnalytics.videoId, nextVideo.videoId))
    //       )
    //       .limit(1);

    //     if (!existing.length) {
    //       const validated = videoAnalyticsSchema.parse({
    //         userId,
    //         videoId: nextVideo.videoId,
    //         videoName: nextVideo.videoTitle,
    //         playCount: 0,
    //         pauseCount: 0,
    //         seekCount: 0,
    //         watchedSeconds: 0,
    //         totalVideoDuration: Math.round(nextVideo.duration / 60),
    //         startDate: new Date(),
    //         endDate: new Date(),
    //         durationSeconds: nextVideo.duration,
    //         watchProgress: 0,
    //         fullyWatched: false,
    //         isExam: false,
    //         examId: null
    //       });

    //       await db.insert(videoAnalytics).values(validated);
    //     }
    //   }
    // }

    if (attempt.examType === 'final' && passed && typeof marks !== 'number') {
      res.status(400).json({
        success: false,
        message: 'Marks are required for passed final exams'
      });
      return;
    }

    if (attempt.examType === 'final' && passed) {
      const relatedExam = await db.query.exams.findFirst({
        where: (exam, { eq }) => eq(exam.examId, attempt.examId),
        columns: {
          examId: true,
          totalMarks: true,
          title: true,
          yearId: true,
          courseId: true // <-- add this
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
      const examCourseId = exam?.courseId; // the year this exam is for
      const course = exam?.course;
      let nextVideo = null;
      let lastYearFlag = false;

      if (course?.years?.length) {
        // Sort years to ensure correct order
        const sortedYears = course.years.sort((a, b) => a.yearId - b.yearId);

        // Find the index of the exam year
        const examYearIndex = sortedYears.findIndex(year => year.yearId === examYearId);

        if (examYearIndex === -1) {
          throw new Error("Exam year not found in course data");
        }

        const isLastYear = examYearIndex === sortedYears.length - 1;

        if (isLastYear) {
          lastYearFlag = true; // No next video
        } else {
          // Next year after exam
          const nextYear = sortedYears[examYearIndex + 1];

          if (nextYear.modules?.length) {
            const firstModule = nextYear.modules[0];
            if (firstModule.months?.length) {
              const firstMonth = firstModule.months[0];

              if (firstMonth.videos?.length) {
                // Sort videos by week number extracted from videoTitle
                const getWeekNumber = (title: string) => {
                  const match = title.match(/week\s*(\d+)/i);
                  return match ? parseInt(match[1], 10) : Infinity; // unknown titles go last
                };

                const sortedVideos = firstMonth.videos
                  .slice() // copy to avoid mutating original
                  .sort((a, b) => getWeekNumber(a.videoTitle) - getWeekNumber(b.videoTitle));

                nextVideo = sortedVideos[0] ?? null; // pick week 1 video
              }
            }
          }
        }
      }

      if (nextVideo && !lastYearFlag) {
        const exisitingAnalytics = await db
          .select()
          .from(videoAnalytics)
          .where(eq(videoAnalytics.userId, Number(userId)));

        const analyticsExists = exisitingAnalytics.find(va => va.videoId === nextVideo?.videoId);

        if (!analyticsExists) {
          const data = {
            userId,
            videoId: nextVideo.videoId,
            videoName: nextVideo.videoTitle,
            playCount: 0,
            pauseCount: 0,
            seekCount: 0,
            watchedSeconds: 0,
            totalVideoDuration: Math.round((nextVideo?.duration ?? 0) / 60),
            startDate: new Date(),
            endDate: new Date(), // will be updated when user actually finishes
            durationSeconds: nextVideo?.duration ?? 0,
            watchProgress: 0,
            fullyWatched: false,
            isExam: false,
            examId: null,
            yearId: examYearId,
            courseId: examCourseId
          }

          const validated = videoAnalyticsSchema.parse(data);

          await db.insert(videoAnalytics).values(validated);
          console.log(`Inserted video ${nextVideo.videoId} for user ${userId} from exam`);

          await db
            .select()
            .from(videoAnalytics)
            .where(eq(videoAnalytics.userId, Number(userId)));
        }
      }

    }

    await db.transaction(async (tx) => {
      await tx
        .update(examAttempts)
        .set({
          passed: passed,
          gradedAt: new Date(),
          gradedBy: adminId,
        })
        .where(eq(examAttempts.attemptId, attemptIdNum));

      if (attempt.examType === 'assignment' || attempt.examType === 'final') {
        await tx
          .update(assignmentSubmissions)
          .set({
            passed: passed,
            feedback: feedback || null,
            totalMarks: marks ? marks.toString() : null,
            isChecked: true,
            checkedAt: new Date(),
            checkedBy: adminId,
          })
          .where(eq(assignmentSubmissions.attemptId, attemptIdNum));
      }
    });

    res.status(200).json({
      success: true,
      message: 'Exam attempt updated successfully',
      data: {
        attemptId: attemptIdNum,
        passed,
        feedback: feedback || null,
        marks: marks || null,
        gradedAt: new Date(),
        gradedBy: adminId,
      }
    });

  } catch (error) {
    console.error('Error updating exam attempt:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const updateEntranceExamAttempt = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { passed, feedback, marks, attemptId } = req.body;
    console.log({ passed })

    if (typeof passed !== 'boolean') {
      res.status(400).json({
        success: false,
        message: 'Pass/fail status (passed) is required and must be boolean'
      });
      return;
    }

    const adminId = req.admin?.adminId;
    if (!adminId) {
      res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
      return;
    }

    const attemptIdNum = Number(attemptId);
    if (isNaN(attemptIdNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid attempt ID'
      });
      return;
    }

    const attemptData = await db
      .select({
        attemptId: entranceExamAttempts.attemptId,
        examId: entranceExamAttempts.entranceExamId,
        userId: entranceExamAttempts.userId,
        passed: entranceExamAttempts.passed,
        gradedAt: entranceExamAttempts.gradedAt,
        mcqPassed: entranceExamAttempts.mcqPassed
      })
      .from(entranceExamAttempts)
      .innerJoin(entranceExams, eq(entranceExamAttempts.entranceExamId, entranceExams.examId))
      .where(eq(entranceExamAttempts.attemptId, attemptIdNum))
      .limit(1);

    if (attemptData.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Exam attempt not found'
      });
      return;
    }

    const attempt = attemptData[0];
    if (attempt.gradedAt) {
      res.status(400).json({
        success: false,
        message: 'This exam attempt has already been graded'
      });
      return;
    }

    const exam = await db.select().from(entranceExams).where(eq(entranceExams.examId, attempt.examId)).limit(1)

    const userId = attempt.userId

    await db.transaction(async (tx) => {
      await tx
        .update(entranceExamAttempts)
        .set({
          passed: passed,
          gradedAt: new Date(),
          gradedBy: adminId,
        })
        .where(eq(entranceExamAttempts.attemptId, attemptIdNum));
    });

    if (passed && attempt.mcqPassed) {
      if (exam[0].title.toLowerCase().includes('bibhusan')) {
        await db.update(users)
          .set({
            bibhusanActive: true
          })
          .where(eq(users.userId, userId));
      } else if (exam[0].title.toLowerCase().includes('ratna')) {
        await db.update(users)
          .set({
            ratnaActive: true
          })
          .where(eq(users.userId, userId));
      }
    }

    res.status(200).json({
      success: true,
      message: 'Exam attempt updated successfully',
      data: {
        attemptId: attemptIdNum,
        passed,
        feedback: feedback || null,
        marks: marks || null,
        gradedAt: new Date(),
        gradedBy: adminId,
      }
    });

  } catch (error) {
    console.error('Error updating exam attempt:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};

export const uploadCertificate = async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { certificateUrl, attemptId } = req.body;

    if (!certificateUrl) {
      res.status(400).json({
        success: false,
        message: 'Certificate URL is required'
      });
      return;
    }

    const adminId = req.admin?.adminId;
    if (!adminId) {
      res.status(401).json({
        success: false,
        message: 'Admin authentication required'
      });
      return;
    }

    const attemptIdNum = Number(attemptId);
    if (isNaN(attemptIdNum)) {
      res.status(400).json({
        success: false,
        message: 'Invalid attempt ID'
      });
      return;
    }

    const attemptData = await db
      .select({
        attemptId: examAttempts.attemptId,
        userId: examAttempts.userId,
        examType: exams.type,
        passed: examAttempts.passed,
        gradedAt: examAttempts.gradedAt,
        courseId: exams.courseId,
        yearId: exams.yearId,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.examId))
      .where(eq(examAttempts.attemptId, attemptIdNum))
      .limit(1);

    if (attemptData.length === 0) {
      res.status(404).json({
        success: false,
        message: 'Exam attempt not found'
      });
      return;
    }
    const attempt = attemptData[0];

    if (attempt.examType !== 'final') {
      res.status(400).json({
        success: false,
        message: 'Certificates can only be uploaded for final exams'
      });
      return;
    }

    if (!attempt.gradedAt) {
      res.status(400).json({
        success: false,
        message: 'Please grade the exam first before uploading a certificate'
      });
      return;
    }

    if (attempt.passed === false) {
      res.status(400).json({
        success: false,
        message: 'Cannot upload certificate for a failed candidate'
      });
      return;
    }

    if (attempt.passed === null) {
      res.status(400).json({
        success: false,
        message: 'Exam result is incomplete. Please update the pass/fail status first'
      });
      return;
    }

    const existingCertificate = await db
      .select()
      .from(certificates)
      .where(
        and(
          eq(certificates.userId, attempt.userId),
          eq(certificates.courseId, attempt.courseId),
          eq(certificates.yearId, attempt.yearId)
        )
      )
      .limit(1);

    if (existingCertificate.length > 0) {
      res.status(400).json({
        success: false,
        message: 'Certificate already exists for this user, course, and year'
      });
      return;
    }

    const certificateId = `CERT_${attempt.courseId}_${attempt.yearId}_${attempt.userId}_${Date.now()}`;

    const [newCertificate] = await db
      .insert(certificates)
      .values({
        certificateId: certificateId,
        userId: attempt.userId,
        courseId: attempt.courseId,
        yearId: attempt.yearId,
        issuedBy: adminId,
        issuedAt: new Date(),
        emailSent: false,
      })
      .returning();

    res.status(200).json({
      success: true,
      message: 'Certificate uploaded successfully',
      data: {
        certificateId: newCertificate.certificateId,
        attemptId: attemptIdNum,
        userId: attempt.userId,
        courseId: attempt.courseId,
        yearId: attempt.yearId,
        certificateUrl,
        issuedAt: newCertificate.issuedAt,
        issuedBy: adminId,
      }
    });

  } catch (error) {
    console.error('Error uploading certificate:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
};
