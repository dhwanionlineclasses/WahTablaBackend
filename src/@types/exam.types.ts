// @types/exam.types.ts
export interface ExamQuestionData {
  courseId?: number; 
  yearNumber: number;
  weekNumber: number;
  type: 'mcq' | 'assignment' | 'final';
  title: string;
  description: string;
  totalMarks?: number; 
  mcqQuestions?: MCQQuestion[];
  assignmentQuestions?: AssignmentQuestion[];
  sections?: ExamSection[]; 
}

export interface MCQQuestion {
  question: string;
  options: {
    text: string;
    isCorrect: boolean;
  }[];
  questionOrder: number;
}

export interface AssignmentQuestion {
  question: string;
  questionOrder: number;
}

export interface ExamSection {
  sectionId?: number;
  name: string;
  description: string;
  marks: number;
  instructions: string;
  sectionOrder?: number;
  questions: FinalExamQuestion[];
}

export interface FinalExamQuestion {
  questionId?: number;
  type: 'objective' | 'short-answer' | 'composition' | 'long-answer';
  text: string;
  order: number;
  marks: number;
  isCompulsory?: boolean;
  requiresDiagram?: boolean;
  requiresMatching?: boolean;
  requiresNotation?: boolean;
  requiresVariations?: boolean;
  requiresTihayi?: boolean;
  requiresBiography?: boolean;
  requiresDefinition?: boolean;
  requiresExamples?: boolean;
  matchingPairs?: { symbol: string; name: string }[];
}
