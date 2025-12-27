# Task Management System

A comprehensive task management system built with Next.js, TypeScript, and Firebase. This application allows users to create, manage, and track tasks with project organization, status tracking, and version management.

## Features

- **Firebase Authentication**: Both frontend and backend login options
- **Task Management**: Create, edit, and delete tasks
- **Project Organization**: Organize tasks by projects with the ability to create new projects
- **Status Tracking**: Tasks can be marked as Pending, Completed, or Deleted
- **Version Management**: Add version numbers (e.g., v1.1.1) to completed tasks
- **User Tracking**: Automatically tracks who completed each task
- **Advanced Filtering**: Filter tasks by:
  - Status (Pending, Completed, Deleted)
  - Project
  - Date range (from date, to date)
  - Search (title and description)

## Getting Started

### Prerequisites

- Node.js 20.9.0 or higher
- Firebase account and project

### Setup

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Configure Firebase:**
   - Create a Firebase project at [Firebase Console](https://console.firebase.google.com/)
   - Enable Authentication (Email/Password)
   - Enable Firestore Database
   - Get your Firebase configuration from Project Settings

3. **Create environment variables:**
   Create a `.env.local` file in the root directory:
   ```env
   NEXT_PUBLIC_FIREBASE_API_KEY=your-api-key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-auth-domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   NEXT_PUBLIC_FIREBASE_APP_ID=your-app-id
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```

5. **Open your browser:**
   Navigate to [http://localhost:3000](http://localhost:3000)

## Project Structure

```
├── app/
│   ├── api/
│   │   └── auth/          # Backend authentication endpoints
│   ├── dashboard/         # Main dashboard page
│   ├── login/             # Login page
│   └── layout.tsx         # Root layout with AuthProvider
├── components/
│   ├── TaskForm.tsx       # Task creation/editing form
│   ├── TaskList.tsx       # Task listing with filters
│   ├── ProjectManager.tsx # Project creation component
│   └── ProtectedRoute.tsx # Route protection component
├── contexts/
│   └── AuthContext.tsx    # Authentication context
├── lib/
│   ├── firebase.ts        # Firebase initialization
│   └── firestore.ts       # Firestore operations
└── types/
    └── index.ts           # TypeScript type definitions
```

## Usage

1. **Sign Up/Login**: Create an account or login using the login page
2. **Create Projects**: Click "New Project" to create a project
3. **Create Tasks**: Click "New Task" to create a task
   - Select or create a project
   - Set status (default: Pending)
   - Add version when marking as Completed
4. **Filter Tasks**: Use the filter panel to search and filter tasks
5. **Update Status**: Change task status using the dropdown in the task card

## Authentication

The application supports two types of authentication:

1. **Frontend Authentication**: Direct Firebase authentication on the client side
2. **Backend Authentication**: API route-based authentication with token management

## Technologies Used

- **Next.js 16**: React framework with App Router
- **TypeScript**: Type-safe development
- **Firebase**: Authentication and Firestore database
- **Tailwind CSS**: Styling

## License

This project is open source and available under the MIT License.
