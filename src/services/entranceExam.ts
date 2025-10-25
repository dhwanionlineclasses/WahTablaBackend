import db from '../db/db_connect';
import {
    entranceExams,
    entranceMcqQuestions,
    entranceMcqOptions
} from '../models';
import { ENTRANCE_EXAMS } from '../data/entranceExam';

export async function syncEntranceExams() {
    try {
        const examOptions = Object.entries(ENTRANCE_EXAMS);
        var courseId = 2;
        for (const [key, value] of examOptions) {
            const [exam] = await db
                .insert(entranceExams)
                .values({
                    courseId: courseId++, // ⚙️ Change this to a valid courseId from your DB
                    title: key,
                    totalMarks: 20,
                    isActive: true,
                })
                .returning({ examId: entranceExams.examId });

            const examId = exam.examId;
            console.log(`🚀 Seeding MCQs for exam = ${key} ...`);

            for (let i = 0; i < value.length; i++) {
                const mcq = value[i];

                // 1️⃣ Insert question
                const [insertedQuestion] = await db
                    .insert(entranceMcqQuestions)
                    .values({
                        examId,
                        question: mcq.question,
                        questionOrder: mcq.number,
                    })
                    .returning({ questionId: entranceMcqQuestions.questionId });

                const questionId = insertedQuestion.questionId;

                console.log(`✅ Added Question ${mcq.number}: ${mcq.question}`);

                // 2️⃣ Insert options
                const options = Object.entries(mcq.options);
                let optionOrder = 1;

                for (const [key, value] of options) {
                    const isCorrect = Boolean(
                        mcq.correct_option &&
                        key.toUpperCase() === mcq.correct_option.toUpperCase()
                    );

                    await db
                        .insert(entranceMcqOptions)
                        .values({
                            questionId,
                            optionText: value,
                            isCorrect,
                            optionOrder,
                        });

                    console.log(
                        `   ➕ Option ${key}: ${value} ${isCorrect ? "(✅ correct)" : ""
                        }`
                    );

                    optionOrder++;
                }
            }
        }


        console.log("🎉 MCQ Seeding Completed Successfully!");
    } catch (error) {
        console.error("❌ Error seeding MCQs:", error);
    }
}

