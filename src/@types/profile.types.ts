interface ExamData {
    examId: number;
    title: string;
    type: string;
    cleared: boolean;
    attempts: number;
    review: boolean;
    failed: boolean;
    marks: number | null;
}

interface ExamWeek {
    weekNumber: number;
    exams: ExamData[];
}

interface MonthData {
    monthId: number;
    monthName: string;
    weeks: ExamWeek[];
}

interface ModuleData {
    moduleId: number;
    moduleName: string;
    months: MonthData[];
}

interface YearData {
    yearId: number;
    yearName: string;
    modules: ModuleData[];
}

type CourseData = {
    courseId: number;
    courseName: string;
    years: YearData[];
};

export { ExamData, ExamWeek, MonthData, ModuleData, YearData, CourseData };
