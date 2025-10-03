import { User, UserProfile } from "../models";


type UserProfileWithoutPassword = Omit<User, "password">;
type ProfileWithoutUserId = Omit<UserProfile, "userId">;

type UserWithProfile = UserProfileWithoutPassword & {
  profile: ProfileWithoutUserId | null; 
};

type VimeoFolder =  {
  name: string;
  uri: string;
  metadata: {
    connections: {
      items: {
        uri: string;
        total: number;
      };
    };
  };
}


type VimeoVideo = {
  uri: string;
  name: string;
  description: string | null;
  duration: number;
  pictures: {
    sizes: Array<{
      link: string;
    }>;
  };
}

type VimeoItem = VimeoFolder | VimeoVideo;

type VimeoResponse = {
  data: Array<{
    type: 'folder' | 'video';
    folder?: VimeoFolder;
    video?: VimeoVideo;
  }>;
}

type UserWithoutPassword = {
    email: string;
    userId: number;
    username: string;
}



type Video = {
  videoId: number;
  videoTitle: string;
  videoUrl: string;
  description: string;
  duration: number;
  thumbnailUrl: string;
};

type Month = {
  monthId: number;
  monthName: string;
  videos: Video[];
};

type Module = {
  moduleId: number;
  moduleName: string;
  months: Month[];
};

type Year = {
  yearId: number;
  yearName: string;
  modules: Module[];
};

type Course = {
  courseId: number;
  courseName: string;
  years: Year[];
};

type ParsedResponse = {
  [courseId: number]: Course;
};

type ItemType = "Course" | "Year" | "Module" | "Month";

type CourseItem = {
  itemType: "Course";
  course: {
    courseId: number;
    courseName: string;
    years: Year[];
  };
};

type YearItem = {
  itemType: "Year";
  year: {
    yearId: number;
    yearName: string;
    course: {
      courseId: number;
      courseName: string;
    };
    modules: Module[];
  };
};

type ModuleItem = {
  itemType: "Module";
  module: {
    moduleId: number;
    moduleName: string;
    course: {
      courseId: number;
      courseName: string;
    };
    year: {
      yearId: number;
      yearName: string;
    };
    months: Month[];
  };
};

type MonthItem = {
  itemType: "Month";
  month: {
    monthId: number;
    monthName: string;
    course: {
      courseId: number;
      courseName: string;
    };
    year: {
      yearId: number;
      yearName: string;
    };
    module: {
      moduleId: number;
      moduleName: string;
    };
    videos: Video[];
  };
};


type OrderItem = CourseItem | YearItem | ModuleItem | MonthItem;


type Order = {
  orderItems: OrderItem[];
};


type ApiResponse = {
  user: UserWithProfile;
  orders: ParsedResponse;
};




export { 
  VimeoFolder, 
  VimeoVideo, 
  UserWithoutPassword, 
  VimeoItem,
  VimeoResponse, 
  UserWithProfile,
  Video,
  Month,
  Module,
  Year,
  Course,
  ParsedResponse,
  ItemType,
  CourseItem,
  YearItem,
  ModuleItem,
  MonthItem,
  OrderItem,
  Order,
  ApiResponse
};
