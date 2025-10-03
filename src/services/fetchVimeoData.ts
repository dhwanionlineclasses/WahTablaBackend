import vimeoAPI from '../config/vimeoConfig';
import db from '../db/db_connect';
import { courses, years, months, videos,modules } from '../models';
import { and, eq, inArray, not } from 'drizzle-orm';
import { VimeoResponse } from '../@types/types';

const VIMEO_USER_ID = process.env.VIMEO_USER_ID;
const COURSE_IDS = {
  Bhusan: process.env.BHUSAN_COURSE_ID,
  Bibhusan: process.env.BIBHUSAN_COURSE_ID,
  Ratna: process.env.RATNA_COURSE_ID,
};

async function getFolderContents(folderId: string): Promise<VimeoResponse['data']> {
    let allItems = [];
    let url = `/users/${VIMEO_USER_ID}/projects/${folderId}/items`;
    console.log("Getting items...");
    // Handle pagination
    while (url) {
      const response = await vimeoAPI.get(url);
      allItems.push(...response.data.data);
      url = response.data.paging?.next || '';
    }
    
    return allItems;
  }

async function syncVideo(monthId: number, video: any, videoId: string) {
  const videoData = {
    videoVimeoId: videoId,
    monthId: monthId,
    videoTitle: video.name,
    videoUrl: `https://vimeo.com/${videoId}`,
    description: video.description,
    duration: video.duration,
    thumbnailUrl: video.pictures.sizes[0]?.link
  };

  const existingVideo = await db.select().from(videos)
    .where(eq(videos.videoVimeoId, videoId));

  if (existingVideo.length === 0) {
    return db.insert(videos).values(videoData);
  }

  return db.update(videos)
    .set(videoData)
    .where(eq(videos.videoVimeoId, videoId));
}


async function processFolder(courseId: number, folderId: string) {
  const folderContents = await getFolderContents(folderId);
  const processedYearIds = new Set<string>();
  const processedMonthIds = new Set<string>();

  const yearItems = folderContents
    .filter(item => item.type === 'folder' && item.folder?.name.startsWith('Year'))
    .map(item => ({
      yearName: item.folder!.name,
      yearId: item.folder!.uri.split('/').pop()!,
      yearNumber: parseInt(item.folder!.name.replace('Year ', ''), 10),
    }))
    .sort((a, b) => a.yearNumber - b.yearNumber); 


  for (const yearItem of yearItems) {
    const { yearName, yearId, yearNumber } = yearItem;
    console.log('Processing year:', yearName);
    console.log('Year ID:', yearId);
    processedYearIds.add(yearId);


    const [year] = await db.insert(years)
      .values({ courseId, yearName, vimeoYearId: yearId })
      .onConflictDoUpdate({
        target: [years.vimeoYearId],
        set: { vimeoYearId:yearId, yearName }
      })
      .returning();

      const monthContents = await getFolderContents(yearId);
      const monthItems = monthContents
      .filter(item => item.type === 'folder' && item.folder?.name.startsWith('Month'))
      .map(item => ({
        monthId: item.folder!.uri.split('/').pop()!,
        monthName: item.folder!.name,
        monthNumber: parseInt(item.folder!.name.replace('Month ', ''), 10),
      }))
      .sort((a, b) => a.monthNumber - b.monthNumber); 

      const startingModuleNumber = (yearNumber - 1) * 4 + 1;

      for (let moduleIndex = 0; moduleIndex < 4; moduleIndex++) {
        const currentModuleNumber = startingModuleNumber + moduleIndex;
        const moduleName = `Module ${currentModuleNumber}`;
        console.log("Module Name: ", moduleName);
        

        const [module] = await db.insert(modules)
          .values({ courseId: courseId, yearId: year.yearId, moduleName})
          .onConflictDoUpdate({
            target: [modules.moduleName],
            set: { moduleName },
          })
          .returning();

       
        const moduleMonths = monthItems.slice(moduleIndex * 3, moduleIndex * 3 + 3);
        for (let i = 0; i < moduleMonths.length; i++) {
          const month = moduleMonths[i];
          await db.insert(months)
            .values({
              courseId: courseId,
              yearId: year.yearId,
              monthName: month.monthName,
              vimeoMonthId: month.monthId,
              moduleId: module.moduleId,
            })
            .onConflictDoUpdate({
              target: [months.vimeoMonthId],
              set: { monthName: month.monthName, moduleId: module.moduleId, yearId: year.yearId },
            });
  
          processedMonthIds.add(month.monthId);
  
          const monthFromDb = await db.select().from(months)
            .where(eq(months.vimeoMonthId, month.monthId))
            .limit(1);

          const videoContents = await getFolderContents(month.monthId);
          const processedVideoIds = new Set<string>();
  
          for (const videoItem of videoContents) {
            if (videoItem.type === 'video' && videoItem.video) {
              const videoId = videoItem.video.uri.split('/').pop()!;
              processedVideoIds.add(videoId);
              await syncVideo(monthFromDb[0].monthId, videoItem.video, videoId);
            }
          }
        }
        }
      }


  // Cleanup deleted months and years
  // await db.delete(months).where(
  //     and(
  //       not(inArray(months.monthId, Array.from(processedMonthIds).map(Number))),
  //       inArray(months.yearId, Array.from(processedYearIds).map(Number))
  //     )
  //   );
    
  //   await db.delete(years).where(
  //     and(
  //       eq(years.courseId, courseId),
  //       not(inArray(years.yearId, Array.from(processedYearIds).map(Number)))
  //     )
  //   );
}



export async function syncVimeoData() {
  try {
    console.log('Starting Vimeo sync...');
    const courseEntries = Object.entries(COURSE_IDS);
    
    for (const [courseName, vimeoCourseId] of courseEntries) {
      if (!vimeoCourseId) continue;
      
      const [course] = await db.insert(courses)
        .values({ courseName, vimeoCourseId })
        .onConflictDoUpdate({
          target: courses.courseName,
          set: { vimeoCourseId }
        })
        .returning();
        
      await processFolder(course.courseId, vimeoCourseId);
    }

    console.log('Vimeo sync completed successfully');
  } catch (error) {
    console.error('Error syncing Vimeo data:', error);
    throw error;
  }
}
