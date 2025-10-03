
---

# Dhwani — Backend for Music Course Platform

**Dhwani** is a backend API built for a music course-selling platform, enabling users to register, log in, purchase individual course modules, ask doubts, and manage profiles. The project is built with **Node.js**, **Express**, **PostgreSQL**, and **Drizzle ORM**, and follows secure and scalable backend practices.

---

## Features

- Secure user authentication with hashed passwords
- User registration and login via email
- Course and module purchase flow (per user)
- Profile management with purchased module details
- Doubt clearance system for users
- Support for image-based references for each course
- Timestamps for all relevant data entries

---

## Tech Stack

| Tech            | Purpose                                  |
|-----------------|-------------------------------------------|
| Node.js         | Server environment                        |
| Express.js      | REST API framework                        |
| PostgreSQL      | Relational database                       |
| Drizzle ORM     | Type-safe SQL and schema management       |
| TypeScript      | Type safety across backend logic          |
| Zod             | Input validation and error handling       |
| Cloudinary      | Image storage and delivery (planned)      |
| JWT             | Authentication and session handling       |
| dotenv          | Secure environment variable management    |
| bcrypt          | Password hashing                          |

---

## Project Structure

```

dhwani/
├── controllers/            # Logic for handling routes
│   └── auth.controller.ts
│   └── user.controller.ts
│   └── course.controller.ts
│   └── doubt.controller.ts
├── db/
│   └── schema/             # Drizzle table definitions
│   └── drizzle.config.ts
│   └── db\_connect.ts
├── middleware/             # Custom middlewares
│   └── authMiddleware.ts
├── routes/                 # API route definitions
│   └── auth.routes.ts
│   └── user.routes.ts
│   └── course.routes.ts
├── utils/                  # Utility functions
│   └── hashPassword.ts
│   └── jwt.ts
├── validations/            # Zod schema validation
│   └── signUpSchema.ts
├── index.ts                # Entry point of the application
├── .env                    # Environment variables
└── package.json

````

---

## Setup & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/EpicAryan/backend-music-course.git
cd backend-music-course
````

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Configure Environment Variables

Create a `.env` file in the root:

```env
PORT=3001
DATABASE_URL=your_postgres_db_url
JWT_SECRET=your_jwt_secret
CLOUDINARY_CLOUD_NAME=your_cloud_name
CLOUDINARY_API_KEY=your_api_key
CLOUDINARY_API_SECRET=your_api_secret
```

> Make sure to replace placeholder values with actual credentials.

### 4. Setup Database & Migrations

Run Drizzle migration to initialize tables:

```bash
npx drizzle-kit push
```

---

## Running the Server

### Development

```bash
npm run dev
# or
yarn dev
```

Server will run at `http://localhost:3001`

### Production

```bash
npm run build
npm start
```

---

## Authentication Flow

* Users can **register** with email and password
* Passwords are hashed using `bcrypt`
* JWT tokens are issued on successful login
* Middleware protects routes for authenticated access

---

## Core API Endpoints

| Route                     | Method | Description                   |
| ------------------------- | ------ | ----------------------------- |
| `/api/auth/register`      | POST   | Register new user             |
| `/api/auth/login`         | POST   | Login with email and password |
| `/api/user/profile`       | GET    | Fetch logged-in user profile  |
| `/api/course/:id/modules` | GET    | Fetch course modules          |
| `/api/purchase/module`    | POST   | Buy individual module         |
| `/api/doubt`              | POST   | Submit a doubt                |

> More endpoints under development for admin panel and instructor access

---

## Planned Features

* Stripe payment integration
* Admin dashboard for course/module management
* In-app doubt discussions and replies
* Email notifications (using Resend or Mailgun)

---

## License

This project is licensed under the [MIT License](LICENSE).

---

## Acknowledgements

* [Drizzle ORM](https://orm.drizzle.team/)
* [Cloudinary](https://cloudinary.com/)
* [PostgreSQL](https://www.postgresql.org/)
* [Zod](https://zod.dev/)
* [Render](https://render.com/) (for future frontend deployment)

---

## Contact

For questions, feedback, or collaboration:

* Raise an issue on [GitHub](https://github.com/EpicAryan/backend-music-course/issues)

---

> Built with 🎶 by [Aryan Kumar](https://github.com/EpicAryan) for seamless online music learning.

```
