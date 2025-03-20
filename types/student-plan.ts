import type { Course } from "./curriculum"

/**
 * Represents the status of a course in a student's plan
 */
export enum CourseStatus {
  PENDING = "pending", // Not started yet
  IN_PROGRESS = "inProgress", // Currently taking
  COMPLETED = "completed", // Successfully completed
  FAILED = "failed", // Failed and needs to retake
  EXEMPTED = "exempted", // Exempted/credited from another institution
  PLANNED = "planned", // Planned for a future semester
}

/**
 * Represents a course in the student's personal plan
 */
export interface StudentCourse extends Omit<Course, "phase"> {
  course: Course 
  status: CourseStatus
  completed: boolean
  grade?: number
  class?: string
}

/**
 * Represents a semester in the student's plan
 */
export interface StudentSemester {
  number: number
  year: string
  courses: StudentCourse[]
  totalCredits: number
}

/**
 * Represents the student's complete academic plan
 */
export interface StudentPlan {
  number: number
  semesters: StudentSemester[]
  inProgressCourses: StudentCourse[]
  plannedCourses: StudentCourse[]
}

export interface StudentInfo {
  id: string
  studentId: string
  name: string
  currentPlan: StudentPlan | null
  plans: StudentPlan[]
}
