class ApiError extends Error {
    public statusCode: number;
    public errors: any[];
    public data: any;
    public success: boolean;
  
    constructor(
      statusCode: number,
      message: string = "Something went wrong",
      errors: any[] = [],
      stack: string = ""
    ) {
      super(message);
      this.statusCode = statusCode;
      this.errors = errors;
      this.data = null;
      this.message = message;
      this.success = false;
  
      if (stack) {
        this.stack = stack;
      } else {
        Error.captureStackTrace(this, this.constructor);
      }
    }
  }
  
  export default ApiError;
  