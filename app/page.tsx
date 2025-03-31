"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { StudentInfo } from "@/types/student-plan"
import { DegreeProgram } from "@/types/degree-program"
import { Curriculum } from "@/types/curriculum"
import { fetchStudentProfile } from "@/app/api/user/profile/[studentId]/route"
import { fetchCurriculum } from "@/app/api/course/curriculum/[programId]/route"
import { fetchClassSchedule } from "@/app/api/class/schedule/client"
import { LogOut } from "lucide-react"

// main visual components
import CurriculumVisualizer from "@/components/visualizers/curriculum-visualizer"
import ProgressVisualizer from "@/components/visualizers/progress-visualizer"
import StudentCourseDetailsPanel from "@/components/details-panel"
import GridVisualizer from "@/components/visualizers/grid-visualizer"
import DependencyTree from "@/components/dependency-tree/dependency-tree"
import Timetable from "@/components/class-schedule/timetable"
import TrashDropZone from "@/components/visualizers/trash-drop-zone"

// types
import type { Course } from "@/types/curriculum"
import type { CurriculumVisualization } from "@/types/visualization"
import type { StudentCourse } from "@/types/student-plan"

// store
import { useStudentStore } from "@/lib/student-store"

// Parser and visualization
import { generateVisualization, courseMap, generatePhases } from "@/lib/parsers/curriculum-parser"

export default function Home() {
  const router = useRouter()
  enum ViewMode {
    CURRICULUM = "curriculum",
    ELECTIVES = "electives"
  }

  // State
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null)
  const [visualization, setVisualization] = useState<CurriculumVisualization | null>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(ViewMode.CURRICULUM)
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null)
  const [selectedStudentCourse, setSelectedStudentCourse] = useState<StudentCourse | null>(null)
  const [showDependencyTree, setShowDependencyTree] = useState(false)
  const [dependencyCourse, setDependencyCourse] = useState<Course | null>(null)
  const [matrufscData, setMatrufscData] = useState<any>(null)
  const [isLoadingMatrufscData, setIsLoadingMatrufscData] = useState(false)
  const [selectedCampus, setSelectedCampus] = useState<string>("")
  const [selectedSemester, setSelectedSemester] = useState<string>("")
  const [loading, setLoading] = useState(true)
  const [profileLoading, setProfileLoading] = useState(true)
  const [curriculumLoading, setCurriculumLoading] = useState(true)
  const [scheduleLoading, setScheduleLoading] = useState(true)
  const [allDataLoaded, setAllDataLoaded] = useState(false)
  const [error, setError] = useState("")
  const [studentInfo, setStudentInfo] = useState<StudentInfo | null>(null)
  const [degreePrograms, setDegreePrograms] = useState<DegreeProgram[]>([])
  const [currentCurriculum, setCurrentCurriculum] = useState<Curriculum | null>(null)
  const [authChecked, setAuthChecked] = useState(false)
  
  // Student store - keep both the destructured values and the full store
  const studentStore = useStudentStore();
  const { studentInfo: storeStudentInfo, lastUpdate } = studentStore;
  
  // Sync the student info from the store to local state
  useEffect(() => {
    if (storeStudentInfo) {
      console.log(`[Home Page] Syncing student info from store, last update: ${new Date(lastUpdate).toISOString()}`);
      setStudentInfo(storeStudentInfo);
    }
  }, [storeStudentInfo, lastUpdate]);

  // Update allDataLoaded when all loading states are false
  useEffect(() => {
    if (!profileLoading && !curriculumLoading && !scheduleLoading) {
      console.log("[Home Page] All data loaded, updating UI")
      setAllDataLoaded(true)
      setLoading(false)
    }
  }, [profileLoading, curriculumLoading, scheduleLoading])

  useEffect(() => {
    // Prevent multiple auth checks
    if (authChecked) return;
    
    const checkAuth = async () => {
      try {
        console.log("[Home Page] Checking authentication status...")
        const response = await fetch("/api/user/auth/check")
        const data = await response.json()
        
        // Mark auth as checked to prevent repeated checks
        setAuthChecked(true)
        
        if (!data.authenticated || !data.userId) {
          console.log("[Home Page] Not authenticated, redirecting to login")
          router.push("/login")
          return
        }
        
        console.log(`[Home Page] User authenticated with userId: ${data.userId}`)

        // Load student profile with the actual user ID
        console.log(`[Home Page] Fetching student profile for userId: ${data.userId}`)
        const profile = await fetchStudentProfile(data.userId)
        if (!profile) {
          console.error("[Home Page] Failed to load student profile")
          throw new Error("Failed to load student profile")
        }
        console.log(`[Home Page] Student profile loaded:`, profile)
        setStudentInfo(profile)
        studentStore.setStudentInfo(profile)
        setProfileLoading(false)

        // Load degree programs
        console.log("[Home Page] Fetching degree programs")
        const programsResponse = await fetch("/api/degree-programs")
        const programsData = await programsResponse.json()
        console.log(`[Home Page] Degree programs loaded:`, programsData.programs)
        setDegreePrograms(programsData.programs)

        // Load curriculum for current degree
        if (profile.currentDegree) {
          console.log(`[Home Page] Fetching curriculum for degree: ${profile.currentDegree}`)
          const curriculumData = await fetchCurriculum(profile.currentDegree)
          
          if (curriculumData) {
            console.log(`[Home Page] Curriculum loaded successfully`)
            
            // Ensure the curriculum data is properly structured
            const processedCurriculum: Curriculum = {
              ...curriculumData,
              // Ensure courses is an array
              courses: Array.isArray(curriculumData.courses) 
                ? curriculumData.courses
                : [] 
            };
            
            console.log(`[Home Page] Processed curriculum has ${processedCurriculum.courses.length} courses`);
            
            // Set the curriculum state
            setCurrentCurriculum(processedCurriculum)
            setCurriculum(processedCurriculum)
            
            if (processedCurriculum.courses.length > 0) {
              // Generate visualization
              console.log(`[Home Page] Generating visualization from curriculum`)
              const visualizationData = generateVisualization(processedCurriculum)
              console.log(`[Home Page] Visualization generated with ${visualizationData.positions.length} course positions`)
              setVisualization(visualizationData)
              
              // For debugging, check if the courseMap is populated
              console.log(`[Home Page] Course map has ${courseMap.size} entries after visualization`);
              if (courseMap.size > 0) {
                console.log(`[Home Page] Sample course from map:`, Array.from(courseMap.entries())[0]);
              }
            } else {
              console.warn(`[Home Page] Curriculum has no courses, unable to generate visualization`)
            }
            
            setCurriculumLoading(false)
          } else {
            console.error(`[Home Page] Failed to load curriculum for degree: ${profile.currentDegree}`)
            setCurriculumLoading(false)
          }
        } else {
          console.error("[Home Page] Profile has no currentDegree property")
          setCurriculumLoading(false)
        }
      } catch (err) {
        console.error("[Home Page] Auth check failed:", err)
        router.push("/login")
      }
    }

    checkAuth()
  }, [router, studentStore, authChecked]) // Added authChecked to dependencies

  // Fetch class schedule data
  useEffect(() => {
    // Skip if no student info is available yet
    if (!studentInfo) return;
    
    // Skip if schedule is already loaded
    if (matrufscData !== null) {
      setScheduleLoading(false)
      return
    }
    
    const fetchScheduleData = async () => {
      try {
        if (!studentInfo?.currentDegree) {
          setScheduleLoading(false)
          return
        }
        
        setIsLoadingMatrufscData(true)
        console.log('Fetching schedule data for student degrees...')
        
        // Get data from API
        const scheduleData = await fetchClassSchedule()
        
        if (!scheduleData) {
          setMatrufscData(null)
          setError('Failed to load class schedules. Please try again later.')
          setScheduleLoading(false)
          return
        }
        
        setMatrufscData(scheduleData)
        console.log('Schedule data loaded for student degrees')
        
        // Log number of courses for debugging
        Object.entries(scheduleData).forEach(([degree, courses]) => {
          if (Array.isArray(courses)) {
            console.log(`Found ${courses.length} courses for degree ${degree}`)
          }
        })
        
        // Only set scheduleLoading to false after data is loaded
        setScheduleLoading(false)
      } catch (error) {
        console.error("Error fetching schedule data:", error)
        setMatrufscData(null)
        setError('An error occurred while loading class schedules.')
        setScheduleLoading(false)
      } finally {
        setIsLoadingMatrufscData(false)
      }
    }
    
    fetchScheduleData()
  }, [studentInfo, matrufscData]) // Add matrufscData as dependency

  // Dependency tree handlers
  const handleViewDependencies = (course: Course) => {
    setDependencyCourse(course)
    setShowDependencyTree(true)
    setSelectedCourse(null)
    setSelectedStudentCourse(null)
  }
  
  const handleCloseDependencyTree = () => {
    setShowDependencyTree(false)
    setDependencyCourse(null)
  }

  // Course handling
  const handleAddCourse = (course: Course) => {
    if (!studentInfo?.currentPlan) {
      console.error("Cannot add course: student plan not found");
      return;
    }
    
    console.log(`Adding course ${course.id} to plan`, course);
    
    // Default to semester 1 if no semesters exist (should never happen with our initialization)
    const targetSemester = studentInfo.currentPlan.semesters.length > 0 
      ? studentInfo.currentPlan.semesters[0]
      : { number: 1 };
      
    console.log(`Target semester for course ${course.id}: ${targetSemester.number}`);
    
    // Add the course to the semester
    studentStore.addCourseToSemester(course, targetSemester.number, -1);
    console.log(`Added ${course.id} to semester ${targetSemester.number}`);
  }

  // Calculate container height
  const containerHeight = 500 // Using fixed height for simplicity

  // View toggle
  const toggleView = () => {
    setViewMode(viewMode === ViewMode.CURRICULUM ? ViewMode.ELECTIVES : ViewMode.CURRICULUM)
  }

  const handleLogout = async () => {
    try {
      await fetch("/api/user/auth/logout", { method: "POST" })
      router.push("/login")
    } catch (err) {
      console.error("Logout failed:", err)
    }
  }

  const getDegreeName = (degreeId: string) => {
    const program = degreePrograms.find(p => p.id === degreeId)
    return program?.name || degreeId
  }

  if (loading || !allDataLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="mb-4">Loading your semester planner...</div>
          <div className="text-sm text-muted-foreground">
            {profileLoading ? "Loading profile..." : "Profile loaded ✓"}
            <br />
            {curriculumLoading ? "Loading curriculum..." : "Curriculum loaded ✓"}
            <br />
            {scheduleLoading ? "Loading class schedule..." : "Schedule loaded ✓"}
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center text-red-500">{error}</div>
      </div>
    )
  }

  if (!studentInfo) {
    return null
  }

  // Get elective courses from the courseMap populated by fetchCurriculum
  const electiveCourses = Array.from(courseMap.values())
    .filter(course => course.type === "optional")

  // Create phase structure for showing in visualization
  const phases = curriculum ? generatePhases(curriculum) : [];

  return (
    <main className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <div className="flex justify-between items-center mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome, {studentInfo.name}
          </h1>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-4 py-2 text-red-500 hover:text-red-700 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Logout
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Current Degree</h2>
            <p className="text-muted-foreground">{getDegreeName(studentInfo.currentDegree)}</p>
            {currentCurriculum && (
              <div className="mt-4">
                <h3 className="text-lg font-medium mb-2">Curriculum</h3>
                <p className="text-muted-foreground">{currentCurriculum.name}</p>
                <p className="text-sm text-muted-foreground">Total Phases: {currentCurriculum.totalPhases}</p>
              </div>
            )}
          </div>

          <div className="bg-card p-6 rounded-lg shadow-lg">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Degrees of Interest</h2>
            <ul className="space-y-2">
              {(studentInfo.interestedDegrees || []).map((degree, index) => (
                <li key={index} className="text-muted-foreground">{getDegreeName(degree)}</li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex-1 p-6 space-y-6">
          <div>
            <div className="flex justify-between items-center mb-2">
              <h2 className="text-xl font-semibold text-foreground">
                {viewMode === ViewMode.CURRICULUM ? "Curriculum Overview" : "Elective Courses"}
              </h2>
              <button
                onClick={toggleView}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition"
              >
                Show {viewMode === ViewMode.CURRICULUM ? "Electives" : "Curriculum"}
              </button>
            </div>
            
            <div
              className="border border-border rounded-lg overflow-hidden shadow-md bg-card"
              style={{ height: `${containerHeight}px` }}
            >
              {viewMode === ViewMode.CURRICULUM ? (
                curriculum && visualization && visualization.positions && visualization.positions.length > 0 ? (
                  <CurriculumVisualizer
                    curriculum={curriculum}
                    visualization={visualization}
                    onCourseClick={setSelectedCourse}
                    height={containerHeight}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-muted-foreground">
                    Loading curriculum data...
                    {curriculum ? 
                      <span className="ml-2">(Curriculum loaded, waiting for visualization...)</span> : 
                      null
                    }
                  </div>
                )
              ) : (
                <GridVisualizer
                  courses={electiveCourses}
                  studentCourses={new Map(studentInfo.currentPlan?.semesters.flatMap(semester => 
                    semester.courses.map(course => [course.course.id, course])
                  ) || [])}
                  onCourseClick={setSelectedCourse}
                  height={containerHeight}
                />
              )}
            </div>
          </div>

          <div>
            <h2 className="text-xl font-semibold mb-2 text-foreground">My Progress</h2>
            <div
              className="border border-border rounded-lg overflow-hidden shadow-md bg-card"
              style={{ height: `${containerHeight}px` }}
            >
              <ProgressVisualizer
                studentPlan={studentInfo.currentPlan!}
                onCourseClick={setSelectedStudentCourse}
                onCourseDropped={(course, semesterNumber, positionIndex) => {
                  console.log(`[Home Page] Dropping course ${course.id} to semester ${semesterNumber} at position ${positionIndex}`);
                  studentStore.addCourseToSemester(course, semesterNumber, positionIndex);
                  // Force a UI update after adding the course
                  setTimeout(() => {
                    studentStore.forceUpdate();
                    console.log(`[Home Page] Forced update after adding course ${course.id}`);
                  }, 100);
                }}
                height={containerHeight}
              />
            </div>
          </div>
          
          <div>
            <Timetable
              studentInfo={studentInfo}
              matrufscData={matrufscData}
              onCourseClick={setSelectedStudentCourse}
              onAddCourse={handleAddCourse}
              selectedCampus={selectedCampus}
              selectedSemester={selectedSemester}
              isLoadingMatrufscData={isLoadingMatrufscData}
              onCampusChange={setSelectedCampus}
              onSemesterChange={setSelectedSemester}
            />
          </div>
        </div>

        {selectedCourse && (
          <StudentCourseDetailsPanel
            course={selectedCourse}
            onClose={() => setSelectedCourse(null)}
            onViewDependencies={() => handleViewDependencies(selectedCourse)}
            onStatusChange={studentStore.changeCourseStatus}
            onGradeChange={studentStore.setCourseGrade}
          />
        )}

        {selectedStudentCourse && (
          <StudentCourseDetailsPanel
            course={selectedStudentCourse.course}
            studentCourse={selectedStudentCourse}
            onClose={() => setSelectedStudentCourse(null)}
            onViewDependencies={() => handleViewDependencies(selectedStudentCourse.course)}
            onStatusChange={studentStore.changeCourseStatus}
            onGradeChange={studentStore.setCourseGrade}
          />
        )}

        {dependencyCourse && (
          <DependencyTree
            course={dependencyCourse}
            isVisible={showDependencyTree}
            onClose={handleCloseDependencyTree}
          />
        )}
        
        <TrashDropZone onRemoveCourse={studentStore.removeCourse} />
      </div>
    </main>
  )
}