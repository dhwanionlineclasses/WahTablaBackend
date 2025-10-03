import db from '../db/db_connect';
import { courses, years, modules, months } from '../models';
import { eq } from 'drizzle-orm';

export interface ResolvedOrderItem {
  orderItemId: number;
  orderId: number;
  itemType: string;
  itemName: string;
  courseId?: number;
  yearId?: number;
  moduleId?: number;
  monthId?: number;
}

export async function resolveOrderItemIds(orderItem: any): Promise<ResolvedOrderItem> {
  const result: ResolvedOrderItem = { ...orderItem };

  try {
    const normalizedItemName = orderItem.itemName.trim();
    

    switch (orderItem.itemType.toLowerCase()) {
      case 'course':
        let course = await db.select({ courseId: courses.courseId, courseName: courses.courseName })
          .from(courses)
          .where(eq(courses.courseName, normalizedItemName))
          .limit(1);
        
        if (course.length === 0) {
          const allCourses = await db.select({ courseId: courses.courseId, courseName: courses.courseName })
            .from(courses);
          
          console.log('Available courses:', allCourses);
          
          course = allCourses.filter(c => 
            c.courseName.toLowerCase() === normalizedItemName.toLowerCase()
          );
        }
        
        if (course.length > 0) {
          result.courseId = course[0].courseId;
        } else {
          console.log(`Could not resolve course: "${normalizedItemName}"`);
        }
        break;

      case 'year':
        let year = await db.select({ yearId: years.yearId, yearName: years.yearName })
          .from(years)
          .where(eq(years.yearName, normalizedItemName))
          .limit(1);
          
        if (year.length === 0) {
          const allYears = await db.select({ yearId: years.yearId, yearName: years.yearName })
            .from(years);
          
          year = allYears.filter(y => 
            y.yearName.toLowerCase() === normalizedItemName.toLowerCase()
          );
        }
        
        if (year.length > 0) {
          result.yearId = year[0].yearId;
        } else {
          console.log(`Could not resolve year: "${normalizedItemName}"`);
        }
        break;

      case 'module':
        const module = await db.select({ moduleId: modules.moduleId })
          .from(modules)
          .where(eq(modules.moduleName, normalizedItemName))
          .limit(1);
        if (module.length > 0) {
          result.moduleId = module[0].moduleId;
        }
        break;

      case 'month':
        const month = await db.select({ monthId: months.monthId })
          .from(months)
          .where(eq(months.monthName, normalizedItemName))
          .limit(1);
        if (month.length > 0) {
          result.monthId = month[0].monthId;
        }
        break;
    }
  } catch (error) {
    console.error(`Error resolving ${orderItem.itemType} ID for ${orderItem.itemName}:`, error);
  }
  return result;
}

export async function resolveMultipleOrderItems(orderItems: any[]): Promise<ResolvedOrderItem[]> {
  const resolved = await Promise.all(
    orderItems.map(item => resolveOrderItemIds(item))
  );
  return resolved;
}
