"use client"

import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import CourseStats from "@/components/course-stats"
import type { Course } from "@/types/curriculum"
import type { StudentInfo, StudentCourse } from "@/types/student-plan"
import { CourseStatus } from "@/types/student-plan"
import type { CoursePosition } from "@/types/visualization"
import scheduleData from "@/data/schedule.json"
import { TIMETABLE, COURSE_COLORS } from "@/config/visualization"

interface TimetableProps {
  studentInfo: StudentInfo
  onCourseClick?: (course: StudentCourse) => void
  onAddCourse?: (course: Course) => void
}

// Type for professor schedule data
type ScheduleEntry = {
  day: number;
  startTime: string;
};

// Type for professor overrides
type ProfessorOverride = {
  courseId: string;
  professorId: string;
  schedule: ScheduleEntry[];
};

export default function Timetable({ studentInfo, onCourseClick, onAddCourse }: TimetableProps) {
  // State for professor overrides
  const [professorOverrides, setProfessorOverrides] = useState<ProfessorOverride[]>([]);

  // Get current courses that are in progress
  const currentCourses = useMemo(() => {
    if (!studentInfo?.currentPlan) return []
    
    // Flatten all courses from all semesters and filter for in-progress ones
    return studentInfo.currentPlan.semesters
      .flatMap(semester => semester.courses)
      .filter(course => course.status === CourseStatus.IN_PROGRESS)
  }, [studentInfo])

  // Handle professor selection
  const handleProfessorSelect = (course: StudentCourse, professorId: string) => {
    // Get the professor data
    const professorData = (scheduleData as any).professors?.[course.course.id]?.find(
      (p: any) => p.professorId === professorId
    );
    
    if (!professorData) return;
    
    // Parse the professor's schedule
    const scheduleText = professorData.schedule;
    
    // Create new schedule entries in the exact same format as the default schedule
    const scheduleEntries: ScheduleEntry[] = [];
    
    // Parse "Terça/Quinta 13:30-15:10" format
    if (scheduleText) {
      const parts = scheduleText.split(' ');
      if (parts.length >= 2) {
        const daysPart = parts[0];
        const timePart = parts[1];
        const daysList = daysPart.split('/');
        const [startTime, endTime] = timePart.split('-');
        
        // For each day mentioned, add a schedule entry
        daysList.forEach((dayName: string) => {
          const dayIndex = TIMETABLE.DAYS_MAP[dayName as keyof typeof TIMETABLE.DAYS_MAP];
          if (dayIndex === undefined || !startTime) return;
          
          // Add exactly 2 slots like the original schedule format
          scheduleEntries.push({
            day: dayIndex,
            startTime: startTime
          });
        });
      }
    }
    
    // Update professor overrides
    setProfessorOverrides(prev => 
      prev.filter(o => o.courseId !== course.course.id).concat({
        courseId: course.course.id,
        professorId,
        schedule: scheduleEntries
      })
    );
  };
  
  // Create a mapping of time slots to courses
  const courseSchedule = useMemo(() => {
    const schedule: Record<string, Record<string, StudentCourse>> = {}
    
    // Initialize empty schedule grid
    TIMETABLE.TIME_SLOTS.forEach(slot => {
      schedule[slot.id] = {}
    })
    
    // Clear existing schedule first
    TIMETABLE.TIME_SLOTS.forEach(slot => {
      TIMETABLE.DAYS.forEach((_, dayIndex) => {
        schedule[slot.id][dayIndex] = undefined as any;
      });
    });
    
    // Track courses that have professor overrides
    const overriddenCourses = new Set(
      professorOverrides.map(override => override.courseId)
    );
    
    // Process default schedules for courses without overrides
    currentCourses.forEach(course => {
      const courseId = course.course.id;
      
      // Skip if this course has a professor override
      if (overriddenCourses.has(courseId)) return;
      
      // Get the default course times
      const courseTimes = scheduleData[courseId as keyof typeof scheduleData];
      if (!courseTimes || !Array.isArray(courseTimes)) return;
      
      // Apply the default schedule
      courseTimes.forEach((timeEntry: any) => {
        const { day, startTime } = timeEntry;
        const startSlotIndex = TIMETABLE.TIME_SLOTS.findIndex(slot => slot.id === startTime);
        
        if (startSlotIndex === -1) return;
        
        // Add the course to the start time slot
        schedule[startTime][day] = course;
        
        // Add the course to the next time slot (for 2-hour classes)
        if (startSlotIndex + 1 < TIMETABLE.TIME_SLOTS.length) {
          const nextSlotId = TIMETABLE.TIME_SLOTS[startSlotIndex + 1].id;
          schedule[nextSlotId][day] = course;
        }
      });
    });
    
    // Process professor overrides
    professorOverrides.forEach(override => {
      const course = currentCourses.find(c => c.course.id === override.courseId);
      if (!course) return;
      
      // Process each schedule entry
      override.schedule.forEach(entry => {
        const { day, startTime } = entry;
        const startSlotIndex = TIMETABLE.TIME_SLOTS.findIndex(slot => slot.id === startTime);
        
        if (startSlotIndex === -1) return;
        
        // Add the course to the start time slot
        schedule[startTime][day] = course;
        
        // Add the course to the next time slot (for 2-hour classes)
        if (startSlotIndex + 1 < TIMETABLE.TIME_SLOTS.length) {
          const nextSlotId = TIMETABLE.TIME_SLOTS[startSlotIndex + 1].id;
          schedule[nextSlotId][day] = course;
        }
      });
    });
    
    return schedule;
  }, [currentCourses, professorOverrides]);

  // Create a map of course IDs to color indices
  const courseColorMap = useMemo(() => {
    const colorMap = new Map<string, string>();
    currentCourses.forEach((course, index) => {
      const colorIndex = index % COURSE_COLORS.length;
      colorMap.set(course.course.id, COURSE_COLORS[colorIndex]);
    });
    return colorMap;
  }, [currentCourses]);

  // Get the color for a course based on its index
  const getCourseColor = (courseId: string) => {
    return courseColorMap.get(courseId) || "border-gray-300 bg-gray-50";
  };

  const [selectedCourse, setSelectedCourse] = useState<StudentCourse | null>(null)

  return (
    <div className="flex flex-col md:flex-row gap-4">
      {/* Timetable - 2/3 width */}
      <div className="w-full md:w-2/3 rounded-lg border shadow-sm overflow-hidden">
        <div className="w-full overflow-auto">
          <table className="w-full border-collapse bg-white table-fixed">
            <colgroup>
              <col style={{ width: '80px' }} />
              {TIMETABLE.DAYS.map((_, index) => (
                <col key={index} style={{ width: `${100 / TIMETABLE.DAYS.length}%` }} />
              ))}
            </colgroup>
            <thead>
              <tr>
                <th className="border bg-gray-100 p-2 font-medium"></th>
                {TIMETABLE.DAYS.map((day, index) => (
                  <th key={index} className="border bg-gray-100 p-3 text-sm font-bold text-center">
                    {day}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {TIMETABLE.TIME_SLOTS.map((slot) => (
                <tr key={slot.id} className="h-14">
                  {/* Time label */}
                  <td className="border bg-gray-50 p-2 text-xs font-bold text-center">
                    {slot.label}
                  </td>
                  {/* Course cells */}
                  {TIMETABLE.DAYS.map((_, dayIndex) => {
                    const course = courseSchedule[slot.id]?.[dayIndex];
                    if (!course) return <td key={dayIndex} className="border" />;

                    return (
                      <td
                        key={dayIndex}
                        className="border p-1"
                        onClick={() => onCourseClick?.(course)}
                      >
                        <div
                          className={cn(
                            "p-1 rounded cursor-pointer",
                            getCourseColor(course.course.id),
                            selectedCourse?.course.id === course.course.id && "ring-2 ring-blue-500"
                          )}
                        >
                          <div className="font-bold text-xs">{course.course.id}</div>
                          <div className="text-xs text-gray-900 truncate">
                            {course.course.name}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Course Stats - 1/3 width */}
      <div className="w-full md:w-1/3">
        <CourseStats
          courses={currentCourses}
          onCourseClick={onCourseClick}
          onAddCourse={onAddCourse}
          onProfessorSelect={handleProfessorSelect}
        />
      </div>
    </div>
  )
}