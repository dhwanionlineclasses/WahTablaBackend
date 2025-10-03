// services/examSync.ts 
import db from '../db/db_connect';
import { 
  exams, 
  mcqQuestions, 
  mcqOptions, 
  assignmentQuestions,
  finalExamSections,
  finalExamQuestions,
  courses, 
  years, 
  assignmentSubmissions,
  mcqResponses
} from '../models';
import { eq, and, inArray, isNull } from 'drizzle-orm';
import { ALL_EXAM_DATA } from '../data/examQuestions';
import { ExamQuestionData } from '../@types/exam.types';

export async function syncExamData() {
  try {
    console.log('Starting comprehensive exam sync...');
    const allCourses = await db.select().from(courses);
    
    for (const course of allCourses) {
      console.log(`Syncing exams for course: ${course.courseName}`);
      
      const courseYears = await db.select()
        .from(years)
        .where(eq(years.courseId, course.courseId));
      
      for (const year of courseYears) {
        const yearNumber = parseInt(year.yearName.replace('Year ', ''));
        console.log(`  Processing ${year.yearName} (Year ${yearNumber})`);
        
        // Get exams from data that should exist for this year
        const applicableExams = ALL_EXAM_DATA.filter(examData => 
          examData.yearNumber === yearNumber 
        );
        
        // Get existing exams from database
        const existingExams = await db.select()
          .from(exams)
          .where(and(
            eq(exams.courseId, course.courseId),
            eq(exams.yearId, year.yearId)
          ));
        
        // Create/Update exams that should exist
        for (const examData of applicableExams) {
          await createOrUpdateExam(course.courseId, year.yearId, yearNumber, examData);
        }
        
        // Delete exams that no longer exist in data
        await deleteRemovedExams(course.courseId, year.yearId, applicableExams, existingExams);
      }
    }
    
    console.log('Comprehensive exam sync completed successfully');
  } catch (error) {
    console.error('Error syncing exam data:', error);
    throw error;
  }
}

async function createOrUpdateExam(
  courseId: number, 
  yearId: number, 
  yearNumber: number,
  examData: ExamQuestionData
) {
  try {
    const existingExam = await db.select()
      .from(exams)
      .where(and(
        eq(exams.courseId, courseId),
        eq(exams.yearId, yearId),
        eq(exams.weekNumber, examData.weekNumber),
        eq(exams.type, examData.type)
      ))
      .limit(1);

    let exam;
    
    if (existingExam.length === 0) {
      // Create new exam
      [exam] = await db.insert(exams)
        .values({
          courseId,
          yearId,
          weekNumber: examData.weekNumber,
          type: examData.type,
          title: examData.title,
          description: examData.description,
          totalMarks: examData.totalMarks,
          isActive: true
        })
        .returning();
      
      console.log(`    Created exam: ${examData.title}`);
    } else {
      // Update existing exam
      [exam] = await db.update(exams)
        .set({
          title: examData.title,
          description: examData.description,
          totalMarks: examData.totalMarks,
          updatedAt: new Date()
        })
        .where(eq(exams.examId, existingExam[0].examId))
        .returning();
      
      console.log(`    Updated exam: ${examData.title}`);
    }

    // Handle different exam types
    switch (examData.type) {
      case 'mcq':
        if (examData.mcqQuestions) {
          await syncMCQQuestions(exam.examId, examData.mcqQuestions);
        }
        break;
      case 'assignment':
        if (examData.assignmentQuestions) {
          await syncAssignmentQuestions(exam.examId, examData.assignmentQuestions);
        }
        break;
      case 'final':
        if (examData.sections) {
          await syncFinalExamSections(exam.examId, examData.sections);
        }
        break;
    }
    
  } catch (error) {
    console.error(`Error creating/updating exam for week ${examData.weekNumber}:`, error);
    throw error;
  }
}


async function syncMCQQuestions(examId: number, questionData: any[]) {
  const existing = await db
    .select()
    .from(mcqQuestions)
    .where(eq(mcqQuestions.examId, examId));

  const wantedMap = new Map(questionData.map(q => [q.questionOrder, q]));

  /*  UPDATE or INSERT  */
  for (const w of questionData) {
    const found = existing.find(e => e.questionOrder === w.questionOrder);
    if (found) {
      await db
        .update(mcqQuestions)
        .set({ question: w.question })
        .where(eq(mcqQuestions.questionId, found.questionId));
    } else {
      // Insert new question
      const [question] = await db.insert(mcqQuestions)
        .values({
          examId,
          question: w.question,
          questionOrder: w.questionOrder
        })
        .returning();

      // Insert options for new question
      for (let i = 0; i < w.options.length; i++) {
        await db.insert(mcqOptions)
          .values({
            questionId: question.questionId,
            optionText: w.options[i].text,
            isCorrect: w.options[i].isCorrect,
            optionOrder: i + 1
          });
      }
    }
  }

  /*  DELETE only questions that disappeared AND have no responses  */
  for (const e of existing) {
    if (!wantedMap.has(e.questionOrder)) {
      const responses = await db
        .select({ questionId: mcqResponses.questionId })
        .from(mcqResponses)
        .where(eq(mcqResponses.questionId, e.questionId))
        .limit(1);
      
      if (responses.length === 0) {
        // Delete options first
        await db.delete(mcqOptions)
          .where(eq(mcqOptions.questionId, e.questionId));
        
        // Then delete the question
        await db
          .delete(mcqQuestions)
          .where(eq(mcqQuestions.questionId, e.questionId));
      } else {
        console.warn(
          `MCQ Question ${e.questionId} has responses – left untouched.`
        );
      }
    }
  }

  // Update options for existing questions
  for (const w of questionData) {
    const found = existing.find(e => e.questionOrder === w.questionOrder);
    if (found) {
      // Delete existing options and recreate them
      await db.delete(mcqOptions)
        .where(eq(mcqOptions.questionId, found.questionId));
      
      // Insert updated options
      for (let i = 0; i < w.options.length; i++) {
        await db.insert(mcqOptions)
          .values({
            questionId: found.questionId,
            optionText: w.options[i].text,
            isCorrect: w.options[i].isCorrect,
            optionOrder: i + 1
          });
      }
    }
  }
}


async function syncAssignmentQuestions(examId: number, questionData: any[]) {
  const existing = await db
    .select()
    .from(assignmentQuestions)
    .where(eq(assignmentQuestions.examId, examId));

  const wantedMap = new Map(questionData.map(q => [q.questionOrder, q]));

  /*  UPDATE or INSERT  */
  for (const w of questionData) {
    const found = existing.find(e => e.questionOrder === w.questionOrder);
    if (found) {
      await db
        .update(assignmentQuestions)
        .set({ question: w.question })
        .where(eq(assignmentQuestions.questionId, found.questionId));
    } else {
      await db.insert(assignmentQuestions).values({
        examId,
        question: w.question,
        questionOrder: w.questionOrder,
      });
    }
  }

  /*  DELETE only questions that disappeared AND have no submissions  */
  for (const e of existing) {
    if (!wantedMap.has(e.questionOrder)) {
      const subs = await db
        .select({ questionId: assignmentSubmissions.questionId })
        .from(assignmentSubmissions)          // make sure you import this table
        .where(eq(assignmentSubmissions.questionId, e.questionId))
        .limit(1);
      if (subs.length === 0) {
        await db
          .delete(assignmentQuestions)
          .where(eq(assignmentQuestions.questionId, e.questionId));
      } else {
        console.warn(
          `Question ${e.questionId} has submissions – left untouched.`
        );
      }
    }
  }
}


async function syncFinalExamSections(examId: number, sectionsData: any[]) {
  const existing = await db
    .select()
    .from(finalExamSections)
    .where(eq(finalExamSections.examId, examId));

  const wantedMap = new Map(sectionsData.map((s, i) => [i + 1, s])); // Using section order as key

  /*  UPDATE or INSERT  */
  for (let i = 0; i < sectionsData.length; i++) {
    const sectionData = sectionsData[i];
    const sectionOrder = i + 1;
    
    const found = existing.find(e => e.sectionOrder === sectionOrder);
    
    if (found) {
      // Update existing section
      await db
        .update(finalExamSections)
        .set({
          name: sectionData.name,
          description: sectionData.description,
          marks: sectionData.marks,
          instructions: sectionData.instructions
        })
        .where(eq(finalExamSections.sectionId, found.sectionId));

      // Update questions for this section
      await syncFinalExamQuestionsForSection(found.sectionId, examId, sectionData.questions);
    } else {
      // Insert new section
      const [section] = await db.insert(finalExamSections)
        .values({
          examId,
          name: sectionData.name,
          description: sectionData.description,
          marks: sectionData.marks,
          instructions: sectionData.instructions,
          sectionOrder: sectionOrder
        })
        .returning();

      // Insert questions for new section
      for (const questionData of sectionData.questions) {
        await db.insert(finalExamQuestions)
          .values({
            sectionId: section.sectionId,
            examId,
            type: questionData.type,
            text: questionData.text,
            questionOrder: questionData.order,
            marks: questionData.marks,
            isCompulsory: questionData.isCompulsory || false,
            requiresDiagram: questionData.requiresDiagram || false,
            requiresMatching: questionData.requiresMatching || false,
            requiresNotation: questionData.requiresNotation || false,
            requiresVariations: questionData.requiresVariations || false,
            requiresTihayi: questionData.requiresTihayi || false,
            requiresBiography: questionData.requiresBiography || false,
            requiresDefinition: questionData.requiresDefinition || false,
            requiresExamples: questionData.requiresExamples || false,
            matchingPairs: questionData.matchingPairs ? JSON.stringify(questionData.matchingPairs) : null
          });
      }
    }
  }

  /*  DELETE only sections that disappeared AND have no related submissions/responses  */
  for (const e of existing) {
    if (!wantedMap.has(e.sectionOrder)) {
      // Check if any questions in this section have responses
      const hasResponses = await checkFinalExamSectionHasResponses(e.sectionId);
      
      if (!hasResponses) {
        // Delete questions first
        await db.delete(finalExamQuestions)
          .where(eq(finalExamQuestions.sectionId, e.sectionId));
        
        // Then delete the section
        await db
          .delete(finalExamSections)
          .where(eq(finalExamSections.sectionId, e.sectionId));
      } else {
        console.warn(
          `Final exam section ${e.sectionId} has responses – left untouched.`
        );
      }
    }
  }
}

async function syncFinalExamQuestionsForSection(sectionId: number, examId: number, questionsData: any[]) {
  const existing = await db
    .select()
    .from(finalExamQuestions)
    .where(eq(finalExamQuestions.sectionId, sectionId));

  const wantedMap = new Map(questionsData.map(q => [q.order, q]));

  /*  UPDATE or INSERT  */
  for (const w of questionsData) {
    const found = existing.find(e => e.questionOrder === w.order);
    if (found) {
      await db
        .update(finalExamQuestions)
        .set({
          type: w.type,
          text: w.text,
          marks: w.marks,
          isCompulsory: w.isCompulsory || false,
          requiresDiagram: w.requiresDiagram || false,
          requiresMatching: w.requiresMatching || false,
          requiresNotation: w.requiresNotation || false,
          requiresVariations: w.requiresVariations || false,
          requiresTihayi: w.requiresTihayi || false,
          requiresBiography: w.requiresBiography || false,
          requiresDefinition: w.requiresDefinition || false,
          requiresExamples: w.requiresExamples || false,
          matchingPairs: w.matchingPairs ? JSON.stringify(w.matchingPairs) : null
        })
        .where(eq(finalExamQuestions.questionId, found.questionId));
    } else {
      await db.insert(finalExamQuestions).values({
        sectionId,
        examId,
        type: w.type,
        text: w.text,
        questionOrder: w.order,
        marks: w.marks,
        isCompulsory: w.isCompulsory || false,
        requiresDiagram: w.requiresDiagram || false,
        requiresMatching: w.requiresMatching || false,
        requiresNotation: w.requiresNotation || false,
        requiresVariations: w.requiresVariations || false,
        requiresTihayi: w.requiresTihayi || false,
        requiresBiography: w.requiresBiography || false,
        requiresDefinition: w.requiresDefinition || false,
        requiresExamples: w.requiresExamples || false,
        matchingPairs: w.matchingPairs ? JSON.stringify(w.matchingPairs) : null
      });
    }
  }

  /*  DELETE only questions that disappeared AND have no responses  */
  for (const e of existing) {
    if (!wantedMap.has(e.questionOrder)) {
      // Check if this question has any responses
      const hasResponses = await checkFinalExamQuestionHasResponses(e.questionId);
      
      if (!hasResponses) {
        await db
          .delete(finalExamQuestions)
          .where(eq(finalExamQuestions.questionId, e.questionId));
      } else {
        console.warn(
          `Final exam question ${e.questionId} has responses – left untouched.`
        );
      }
    }
  }
}


async function deleteRemovedExams(
  courseId: number, 
  yearId: number, 
  applicableExams: ExamQuestionData[], 
  existingExams: any[]
) {
  const examKeysFromData = applicableExams.map(e => `${e.weekNumber}-${e.type}`);
  const examsToDelete = existingExams.filter(e => 
    !examKeysFromData.includes(`${e.weekNumber}-${e.type}`)
  );

  for (const examToDelete of examsToDelete) {
    console.log(`    Deleting removed exam: ${examToDelete.title}`);
    
    // Delete related data first
    await deleteExamData(examToDelete.examId);
    
    // Delete the exam
    await db.delete(exams)
      .where(eq(exams.examId, examToDelete.examId));
  }
}

async function deleteExamData(examId: number) {
  // Delete MCQ data
  const mcqQuestionsToDelete = await db.select()
    .from(mcqQuestions)
    .where(eq(mcqQuestions.examId, examId));
  
  for (const question of mcqQuestionsToDelete) {
    await db.delete(mcqOptions)
      .where(eq(mcqOptions.questionId, question.questionId));
  }
  
  await db.delete(mcqQuestions)
    .where(eq(mcqQuestions.examId, examId));

  // Delete assignment questions
  await db.delete(assignmentQuestions)
    .where(eq(assignmentQuestions.examId, examId));

  // Delete final exam data
  const finalSectionsToDelete = await db.select()
    .from(finalExamSections)
    .where(eq(finalExamSections.examId, examId));
  
  for (const section of finalSectionsToDelete) {
    await db.delete(finalExamQuestions)
      .where(eq(finalExamQuestions.sectionId, section.sectionId));
  }
  
  await db.delete(finalExamSections)
    .where(eq(finalExamSections.examId, examId));
}


async function checkFinalExamSectionHasResponses(sectionId: number): Promise<boolean> {
  // Get all questions in this section
  const questions = await db
    .select({ questionId: finalExamQuestions.questionId })
    .from(finalExamQuestions)
    .where(eq(finalExamQuestions.sectionId, sectionId));
  
  if (questions.length === 0) {
    return false;
  }

  // First, check if there are submissions for the exam that contains this section
  const section = await db
    .select({ examId: finalExamSections.examId })
    .from(finalExamSections)
    .where(eq(finalExamSections.sectionId, sectionId))
    .limit(1);
    
  if (section.length === 0) {
    return false;
  }
  
  // Check for any submissions for this exam
  const examSubmissions = await db
    .select({ submissionId: assignmentSubmissions.submissionId })
    .from(assignmentSubmissions)
    .where(
      and(
        eq(assignmentSubmissions.examId, section[0].examId),
        isNull(assignmentSubmissions.questionId)
      )
    )
    .limit(1);
    
  return examSubmissions.length > 0;
}

async function checkFinalExamQuestionHasResponses(questionId: number): Promise<boolean> {
  // Get the exam ID for this question
  const question = await db
    .select({ 
      examId: finalExamQuestions.examId,
      sectionId: finalExamQuestions.sectionId 
    })
    .from(finalExamQuestions)
    .where(eq(finalExamQuestions.questionId, questionId))
    .limit(1);
    
  if (question.length === 0) {
    return false;
  }
  
  // we don't delete the questions
  const examSubmissions = await db
    .select({ submissionId: assignmentSubmissions.submissionId })
    .from(assignmentSubmissions)
    .where(eq(assignmentSubmissions.examId, question[0].examId))
    .limit(1);
    
  return examSubmissions.length > 0;
}
