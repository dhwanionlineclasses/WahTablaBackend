import { Request, Response } from "express";
import { AdminWithoutPassword } from "../../@types/admin.types";
import { and, desc, eq, sql, count, inArray } from "drizzle-orm";
import { videoAnalytics, assignmentSubmissions, courses, examAttempts, exams, modules, months, orderItems, orders, userProfiles, users, years } from "../../models";
import db from "../../db/db_connect";
import { getUserParamsSchema, getUsersQuerySchema } from "../../schemas/adminSchema";
import asyncHandler from "../../utils/asyncHandler";


interface AdminRequest extends Request {
  admin?: AdminWithoutPassword;
}

const getUsersBasicDetails = asyncHandler(async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { search, page, limit, sortBy, sortOrder } = getUsersQuerySchema.parse(req.query);
    const offset = (Number(page) - 1) * Number(limit);

    const whereConditions = [];

    if (search && typeof search === 'string') {
      whereConditions.push(
        sql`(
          ${users.username} ILIKE ${`%${search}%`} OR 
          ${users.email} ILIKE ${`%${search}%`} OR 
          ${userProfiles.fullName} ILIKE ${`%${search}%`}
        )`
      );
    }

    const getSortColumn = (sortBy: string, sortOrder: string) => {
      const isDesc = sortOrder === 'desc';

      switch (sortBy) {
        case 'username':
          return isDesc ? desc(users.username) : users.username;
        case 'email':
          return isDesc ? desc(users.email) : users.email;
        case 'createdAt':
          return isDesc ? desc(users.createdAt) : users.createdAt;
        case 'updatedAt':
          return isDesc ? desc(users.updatedAt) : users.updatedAt;
        default:
          return desc(users.createdAt);
      }
    };

    const usersData = await db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        fullName: userProfiles.fullName,
        gender: userProfiles.gender,
        profileCreatedAt: userProfiles.createdAt,
        totalOrders: sql<number>`COUNT(DISTINCT ${orders.orderId})`.as('totalOrders'),
        totalSpent: sql<string>`COALESCE(SUM(${orders.totalAmount}), 0)`.as('totalSpent'),
        lastOrderDate: sql<Date>`MAX(${orders.orderDate})`.as('lastOrderDate'),
        currency: sql<string>`MAX(${orders.currency})`.as('currency'),
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .leftJoin(orders, and(
        eq(users.userId, orders.userId),
        eq(orders.paymentStatus, 'succeeded')
      ))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined)
      .groupBy(
        users.userId,
        users.username,
        users.email,
        users.createdAt,
        users.updatedAt,
        userProfiles.fullName,
        userProfiles.gender,
        userProfiles.createdAt
      )
      .orderBy(getSortColumn(sortBy as string, sortOrder as string))
      .limit(Number(limit))
      .offset(offset);

    const totalCountResult = await db
      .select({ count: count() })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(whereConditions.length > 0 ? and(...whereConditions) : undefined);

    const totalCount = totalCountResult[0]?.count || 0;
    var index = 0;
    const formattedUsers = await Promise.all(usersData.map(async user => {
      // fetch all succeeded orders for this user
      const userOrders = await db.query.orders.findMany({
        where: (orders, { eq }) => eq(orders.userId, user.userId),
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

      // build purchasedDetails for this user
      const purchasedDetails: { [key: string]: any } = {};

      userOrders.forEach(order => {
        order.orderItems.forEach(item => {
          switch (item.itemType) {
            case "Course": {
              const course = item.course;
              if (course) {
                const courseData = {
                  courseName: course.courseName,
                  courseId: course.courseId,
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
              }
              break;
            }
            case "Year": {
              const year = item.year
              if (item.year && item.year.course) {
                const courseId = item.year.course.courseId;
                if (!purchasedDetails[courseId]) {
                  purchasedDetails[courseId] = {
                    courseName: item.year.course.courseName,
                    years: []
                  };
                }

                const yearData = {
                  yearId: item.year.yearId,
                  courseId: courseId,
                  yearName: item.year.yearName,
                  modules: item.year.modules.map((module: any) => ({
                    moduleId: module.moduleId,
                    moduleName: module.moduleName,
                    months: module.months.map((month: any) => ({
                      monthId: month.monthId,
                      monthName: month.monthName,
                      videos: month.videos.map((video: any) => ({
                        videoId: video.videoId,
                        videoVimeoId: video.videoVimeoId,
                        videoTitle: video.videoTitle,
                        videoUrl: video.videoUrl,
                        description: video.description,
                        duration: video.duration,
                        thumbnailUrl: video.thumbnailUrl
                      }))
                    }))
                  }))
                };

                const existingYearIndex = purchasedDetails[courseId].years.findIndex(
                  (y: any) => y.yearId === item.year?.yearId
                );
                if (existingYearIndex === -1) {
                  purchasedDetails[courseId].years.push(yearData);
                } else {
                  purchasedDetails[courseId].years[existingYearIndex] = yearData;
                }
              }
              break;
            }
            case "Module": {
              const modules = item.module
              if (item.module && item.module.course && item.module.year) {
                const courseId = item.module.course.courseId;
                if (!purchasedDetails[courseId]) {
                  purchasedDetails[courseId] = {
                    courseName: item.module.course.courseName,
                    years: []
                  };
                }

                let yearIndex = purchasedDetails[courseId].years.findIndex(
                  (y: any) => y.yearId === item.module?.year.yearId
                );

                if (yearIndex === -1) {
                  purchasedDetails[courseId].years.push({
                    yearId: item.module.year.yearId,
                    yearName: item.module.year.yearName,
                    modules: []
                  });
                  yearIndex = purchasedDetails[courseId].years.length - 1;
                }

                const moduleData = {
                  moduleId: item.module.moduleId,
                  courseId: courseId,
                  yearId: item.module?.year.yearId,
                  moduleName: item.module.moduleName,
                  months: item.module.months.map((month: any) => ({
                    monthId: month.monthId,
                    monthName: month.monthName,
                    videos: month.videos.map((video: any) => ({
                      videoId: video.videoId,
                      videoVimeoId: video.videoVimeoId,
                      videoTitle: video.videoTitle,
                      videoUrl: video.videoUrl,
                      description: video.description,
                      duration: video.duration,
                      thumbnailUrl: video.thumbnailUrl
                    }))
                  }))
                };

                const existingModuleIndex = purchasedDetails[courseId].years[yearIndex].modules.findIndex(
                  (m: any) => m.moduleId === item.module?.moduleId
                );
                if (existingModuleIndex === -1) {
                  purchasedDetails[courseId].years[yearIndex].modules.push(moduleData);
                } else {
                  purchasedDetails[courseId].years[yearIndex].modules[existingModuleIndex] = moduleData;
                }
              }
              break;
            }
            case "Month": {
              const month = item.month
              if (item.month && item.month.course && item.month.year && item.month.module) {
                const courseId = item.month.course.courseId;
                if (!purchasedDetails[courseId]) {
                  purchasedDetails[courseId] = {
                    courseName: item.month.course.courseName,
                    years: []
                  };
                }

                let yearIndex = purchasedDetails[courseId].years.findIndex(
                  (y: any) => y.yearId === item.month?.year.yearId
                );

                if (yearIndex === -1) {
                  purchasedDetails[courseId].years.push({
                    yearId: item.month.year.yearId,
                    yearName: item.month.year.yearName,
                    modules: []
                  });
                  yearIndex = purchasedDetails[courseId].years.length - 1;
                }

                let moduleIndex = purchasedDetails[courseId].years[yearIndex].modules.findIndex(
                  (m: any) => m.moduleId === item.month?.module.moduleId
                );

                if (moduleIndex === -1) {
                  purchasedDetails[courseId].years[yearIndex].modules.push({
                    moduleId: item.month.module.moduleId,
                    moduleName: item.month.module.moduleName,
                    months: []
                  });
                  moduleIndex = purchasedDetails[courseId].years[yearIndex].modules.length - 1;
                }

                const monthData = {
                  monthId: item.month.monthId,
                  courseId: courseId,
                  yearId: item.month?.year.yearId,
                  monthName: item.month.monthName,
                  videos: item.month.videos.map((video: any) => ({
                    videoId: video.videoId,
                    videoVimeoId: video.videoVimeoId,
                    videoTitle: video.videoTitle,
                    videoUrl: video.videoUrl,
                    description: video.description,
                    duration: video.duration,
                    thumbnailUrl: video.thumbnailUrl
                  }))
                };

                const existingMonthIndex = purchasedDetails[courseId].years[yearIndex].modules[moduleIndex].months.findIndex(
                  (m: any) => m.monthId === item.month?.monthId
                );
                if (existingMonthIndex === -1) {
                  purchasedDetails[courseId].years[yearIndex].modules[moduleIndex].months.push(monthData);
                } else {
                  purchasedDetails[courseId].years[yearIndex].modules[moduleIndex].months[existingMonthIndex] = monthData;
                }
              }
              break;
            }
            default:
              console.warn("Unknown item type:", item.itemType);
          }
        });
      });

      let analytics = await db
        .select()
        .from(videoAnalytics)
        .where(eq(videoAnalytics.userId, Number(user.userId)));

      return {
        userId: user.userId,
        username: user.username,
        email: user.email,
        fullName: user.fullName || 'Not provided',
        gender: user.gender || 'Not specified',
        registeredAt: user.createdAt,
        lastUpdated: user.updatedAt,
        profileCompleted: !!user.fullName,
        totalOrders: user.totalOrders || 0,
        totalSpent: parseFloat(user.totalSpent || '0'),
        lastOrderDate: user.lastOrderDate,
        hasPurchases: (user.totalOrders || 0) > 0,
        purchasedDetails, // ✅ attached here
        analytics: analytics.length > 0 ? analytics : [],
        currency: user.currency || 'USD'
      };
    }));


    res.status(200).json({
      success: true,
      data: {
        users: formattedUsers,
        totalUsers: totalCount,
        usersWithCompleteProfiles: formattedUsers.filter(u => u.profileCompleted).length,
        pagination: {
          page: Number(page),
          limit: Number(limit),
          total: totalCount,
          totalPages: Math.ceil(totalCount / Number(limit))
        }
      },
      message: 'Users retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching users:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

const getUserSpecificDetails = asyncHandler(async (req: AdminRequest, res: Response): Promise<void> => {
  try {
    const { userId } = getUserParamsSchema.parse(req.params);
    const userIdNum = Number(userId);
    if (Number.isNaN(userIdNum)) {
      res.status(400).json({ success: false, message: 'Invalid user ID' });
      return;
    }
    const userRow = await db
      .select({
        userId: users.userId,
        username: users.username,
        email: users.email,
        createdAt: users.createdAt,
        updatedAt: users.updatedAt,
        fullName: userProfiles.fullName,
        gender: userProfiles.gender
      })
      .from(users)
      .leftJoin(userProfiles, eq(users.userId, userProfiles.userId))
      .where(eq(users.userId, userIdNum))
      .limit(1);

    if (userRow.length === 0) {
      res.status(404).json({ success: false, message: 'User not found' });
      return;
    }
    const user = userRow[0];

    const items = await db
      .select({
        itemType: orderItems.itemType,
        itemName: orderItems.itemName
      })
      .from(orders)
      .innerJoin(orderItems, eq(orders.orderId, orderItems.orderId))
      .where(
        and(eq(orders.userId, userIdNum), eq(orders.paymentStatus, 'succeeded'))
      );

    const coursesPurchased = items.filter(i => i.itemType.toLowerCase() === 'course').map(i => i.itemName);
    const yearsPurchased = items.filter(i => i.itemType.toLowerCase() === 'year').map(i => i.itemName);
    const modulesPurchased = items.filter(i => i.itemType.toLowerCase() === 'module').map(i => i.itemName);
    const monthsPurchased = items.filter(i => i.itemType.toLowerCase() === 'month').map(i => i.itemName);

    const courseRows = coursesPurchased.length
      ? await db.select({ courseId: courses.courseId, courseName: courses.courseName })
        .from(courses)
        .where(inArray(courses.courseName, coursesPurchased))
      : [];

    const yearRows = yearsPurchased.length
      ? await db
        .select({
          courseId: courses.courseId,
          courseName: courses.courseName,
          yearId: years.yearId,
          yearName: years.yearName
        })
        .from(years)
        .innerJoin(courses, eq(years.courseId, courses.courseId))
        .where(inArray(years.yearName, yearsPurchased))
      : [];

    const moduleRows = modulesPurchased.length
      ? await db
        .select({
          courseId: courses.courseId,
          courseName: courses.courseName,
          yearId: years.yearId,
          yearName: years.yearName,
          moduleId: modules.moduleId,
          moduleName: modules.moduleName
        })
        .from(modules)
        .innerJoin(years, eq(modules.yearId, years.yearId))
        .innerJoin(courses, eq(modules.courseId, courses.courseId))
        .where(inArray(modules.moduleName, modulesPurchased))
      : [];

    const monthRows = monthsPurchased.length
      ? await db
        .select({
          courseId: courses.courseId,
          courseName: courses.courseName,
          yearId: years.yearId,
          yearName: years.yearName,
          moduleId: modules.moduleId,
          moduleName: modules.moduleName,
          monthId: months.monthId,
          monthName: months.monthName
        })
        .from(months)
        .innerJoin(modules, eq(months.moduleId, modules.moduleId))
        .innerJoin(years, eq(months.yearId, years.yearId))
        .innerJoin(courses, eq(months.courseId, courses.courseId))
        .where(inArray(months.monthName, monthsPurchased))
      : [];

    const bought = [
      ...courseRows.map(c => ({ courseId: c.courseId, courseName: c.courseName })),

      ...yearRows.map(y => ({
        courseId: y.courseId,
        courseName: y.courseName,
        yearId: y.yearId,
        yearName: y.yearName
      })),

      ...moduleRows.map(m => ({
        courseId: m.courseId,
        courseName: m.courseName,
        yearId: m.yearId,
        yearName: m.yearName,
        moduleId: m.moduleId,
        moduleName: m.moduleName
      })),

      ...monthRows.map(mn => ({
        courseId: mn.courseId,
        courseName: mn.courseName,
        yearId: mn.yearId,
        yearName: mn.yearName,
        moduleId: mn.moduleId,
        moduleName: mn.moduleName,
        monthId: mn.monthId,
        monthName: mn.monthName
      }))
    ];


    const examAttemptsData = await db
      .select({
        attemptId: examAttempts.attemptId,
        examId: exams.examId,
        examTitle: exams.title,
        examType: exams.type,
        weekNumber: exams.weekNumber,
        courseName: courses.courseName,
        yearName: years.yearName,
        attemptNumber: examAttempts.attemptNumber,
        passed: examAttempts.passed,
        submittedAt: examAttempts.submittedAt,
        gradedAt: examAttempts.gradedAt,
      })
      .from(examAttempts)
      .innerJoin(exams, eq(examAttempts.examId, exams.examId))
      .innerJoin(courses, eq(exams.courseId, courses.courseId))
      .innerJoin(years, eq(exams.yearId, years.yearId))
      .where(eq(examAttempts.userId, userIdNum))
      .orderBy(desc(examAttempts.submittedAt));


    const assignmentData = await db
      .select({
        examId: assignmentSubmissions.examId,
        isChecked: assignmentSubmissions.isChecked,
        passed: assignmentSubmissions.passed,
        totalMarks: assignmentSubmissions.totalMarks,
        feedback: assignmentSubmissions.feedback,
      })
      .from(assignmentSubmissions)
      .where(eq(assignmentSubmissions.userId, userIdNum));

    const assignmentMap = assignmentData.reduce((acc, assignment) => {
      acc[assignment.examId] = assignment;
      return acc;
    }, {} as Record<number, typeof assignmentData[0]>);


    const enhancedExamAttempts = examAttemptsData.map(attempt => {
      const assignment = assignmentMap[attempt.examId];

      return {
        attemptId: attempt.attemptId,
        examId: attempt.examId,
        examTitle: attempt.examTitle,
        examType: attempt.examType,
        course: attempt.courseName,
        year: attempt.yearName,
        week: attempt.weekNumber,
        attemptNumber: attempt.attemptNumber,
        status: attempt.passed === null ? 'pending' : (attempt.passed ? 'passed' : 'failed'),
        submittedAt: attempt.submittedAt,
        gradedAt: attempt.gradedAt,
        isGraded: !!attempt.gradedAt,
        ...(assignment && {
          isChecked: assignment.isChecked,
          totalMarks: assignment.totalMarks ? parseFloat(assignment.totalMarks) : null,
          feedback: assignment.feedback,
          needsReview: !assignment.isChecked
        })
      };
    });

    const examStats = {
      totalAttempts: examAttemptsData.length,
      passed: examAttemptsData.filter(a => a.passed === true).length,
      failed: examAttemptsData.filter(a => a.passed === false).length,
      pending: examAttemptsData.filter(a => a.passed === null).length,
      byType: {
        mcq: examAttemptsData.filter(a => a.examType === 'mcq').length,
        assignment: examAttemptsData.filter(a => a.examType === 'assignment').length,
        final: examAttemptsData.filter(a => a.examType === 'final').length,
      },
      needingReview: assignmentData.filter(a => !a.isChecked).length
    };


    res.status(200).json({
      success: true,
      data: {
        userInfo: {
          userId: user.userId,
          username: user.username,
          email: user.email,
          fullName: user.fullName || 'Not provided',
          gender: user.gender || 'Not specified',
          registeredAt: user.createdAt,
          lastUpdated: user.updatedAt,
        },
        bought,
        examAttempts: enhancedExamAttempts,
        statistics: examStats
      },
      message: 'User details retrieved successfully'
    });

  } catch (error) {
    console.error('Error fetching user details:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error'
    });
  }
});

export {
  getUserSpecificDetails,
  getUsersBasicDetails
}
