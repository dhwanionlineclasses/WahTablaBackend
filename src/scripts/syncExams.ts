
import { syncExamData } from '../services/examSync';

syncExamData()
  .then(() => {
    console.log('Exam sync completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Exam sync failed:', error);
    process.exit(1);
  });
