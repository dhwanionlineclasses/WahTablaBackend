
import db from "../db/db_connect";
import { 
  assignmentQuestions,
  finalExamSections, 
  finalExamQuestions,
  examAttempts,
} from "../models";
import { eq, and, sql, gte, lt } from "drizzle-orm";



// Helper function to get assignment questions  
async function getAssignmentQuestions(examId: number) {
  const questionsResults = await db.select()
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.examId, examId))
    .orderBy(assignmentQuestions.questionOrder);

  return questionsResults.map(question => ({
    questionId: question.questionId,
    question: question.question,
    questionOrder: question.questionOrder
  }));
}

// Helper function to get final exam sections and questions
async function getFinalExamSections(examId: number) {
  const sectionsResults = await db.select()
    .from(finalExamSections)
    .where(eq(finalExamSections.examId, examId))
    .orderBy(finalExamSections.sectionOrder);

  const sections = [];
  for (const section of sectionsResults) {
    const questionsResults = await db.select()
      .from(finalExamQuestions)
      .where(eq(finalExamQuestions.sectionId, section.sectionId))
      .orderBy(finalExamQuestions.questionOrder);

    const questions = questionsResults.map(question => ({
      questionId: question.questionId,
      type: question.type,
      text: question.text,
      questionOrder: question.questionOrder,
      marks: question.marks,
      isCompulsory: question.isCompulsory,
      requiresDiagram: question.requiresDiagram,
      requiresMatching: question.requiresMatching,
      requiresNotation: question.requiresNotation,
      requiresVariations: question.requiresVariations,
      requiresTihayi: question.requiresTihayi,
      requiresBiography: question.requiresBiography,
      requiresDefinition: question.requiresDefinition,
      requiresExamples: question.requiresExamples,
      matchingPairs: question.matchingPairs ? JSON.parse(question.matchingPairs) : null
    }));

    sections.push({
      sectionId: section.sectionId,
      name: section.name,
      description: section.description,
      marks: section.marks,
      instructions: section.instructions,
      sectionOrder: section.sectionOrder,
      questions
    });
  }
  return sections;
}

// Helper function to check daily MCQ attempts
async function checkMcqAttemptLimit(userId: number, examId: number): Promise<{ canAttempt: boolean; attemptsToday: number }> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const todayAttempts = await db.select()
    .from(examAttempts)
    .where(and(
      eq(examAttempts.userId, userId),
      eq(examAttempts.examId, examId),
      gte(examAttempts.submittedAt, today),
      lt(examAttempts.submittedAt, tomorrow)
    ));

  const attemptsToday = todayAttempts.length;
  const canAttempt = attemptsToday < 3;

  return { canAttempt, attemptsToday };
}


// Helper function to check if user has already passed
async function checkIfAlreadyPassed(userId: number, examId: number): Promise<boolean> {
  const passedAttempt = await db.select()
    .from(examAttempts)
    .where(and(
      eq(examAttempts.userId, userId),
      eq(examAttempts.examId, examId),
      eq(examAttempts.passed, true)
    ))
    .limit(1);

  return passedAttempt.length > 0;
}


// Helper function to check assignment re-attempt eligibility
async function checkAssignmentReAttemptEligibility(userId: number, examId: number): Promise<{ canAttempt: boolean; reason?: string }> {
  const latestAttempt = await db.select()
    .from(examAttempts)
    .where(and(
      eq(examAttempts.userId, userId),
      eq(examAttempts.examId, examId)
    ))
    .orderBy(sql`${examAttempts.submittedAt} DESC`)
    .limit(1);

  if (latestAttempt.length === 0) {
    return { canAttempt: true };
  }

  const attempt = latestAttempt[0];

  if (attempt.passed) {
    return { canAttempt: false, reason: 'You have already passed this assignment' };
  }

  if (!attempt.gradedAt) {
    return { canAttempt: false, reason: 'Your previous submission is still being graded. Please wait for the results.' };
  }
  return { canAttempt: true };
}
export { 
    getAssignmentQuestions, 
    getFinalExamSections, 
    checkMcqAttemptLimit,
    checkIfAlreadyPassed,
    checkAssignmentReAttemptEligibility
}
