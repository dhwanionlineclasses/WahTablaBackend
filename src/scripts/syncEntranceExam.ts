
import { syncEntranceExams } from "../services/entranceExam";

syncEntranceExams()
  .then(() => {
    console.log('Entrance Exam sync completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Entrance Exam sync failed:', error);
    process.exit(1);
  });
