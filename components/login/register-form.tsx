"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { generateSalt, deriveEncryptionKey, encryptData } from "@/lib/crypto"
import type { StudentInfo } from "@/types/student-plan"

interface RegisterFormData {
  username: string
  password: string
  name: string
  studentId: string
  currentDegree: string
  interestedDegrees: string[]
}

export default function RegisterForm() {
  const router = useRouter()
  const [formData, setFormData] = useState<RegisterFormData>({
    username: "",
    password: "",
    name: "",
    studentId: "",
    currentDegree: "",
    interestedDegrees: [],
  })
  const [error, setError] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")
    setIsLoading(true)

    try {
      // Generate encryption salt
      const salt = generateSalt()
      
      // Derive key from password and salt
      const encryptionKey = deriveEncryptionKey(formData.password, salt)
      
      // Create student info object that will be encrypted
      const studentInfo: StudentInfo = {
        id: formData.username,
        name: formData.name,
        studentId: formData.studentId,
        currentDegree: formData.currentDegree,
        interestedDegrees: formData.interestedDegrees,
        currentSemester: "1",
        plans: [],
        currentPlan: {
          id: "default-plan",
          semesters: [
            {
              number: 1,
              courses: [],
              totalCredits: 0
            },
          ],
        },
      }
      
      // Encrypt the student data
      const encrypted = encryptData(studentInfo, encryptionKey)
      
      // Send register request with encrypted data
      const response = await fetch("/api/user/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username: formData.username,
          password: formData.password,
          salt,
          encryptedData: encrypted
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || "Registration failed")
      }

      router.push("/login")
    } catch (err: any) {
      setError(err.message || "Registration failed. Please try again.")
    } finally {
      setIsLoading(false)
    }
  }

  const handleInterestedDegreeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const degree = e.target.value
    if (e.target.checked) {
      setFormData(prev => ({
        ...prev,
        interestedDegrees: [...prev.interestedDegrees, degree]
      }))
    } else {
      setFormData(prev => ({
        ...prev,
        interestedDegrees: prev.interestedDegrees.filter(d => d !== degree)
      }))
    }
  }

  return (
    <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold text-center text-foreground">Register</h1>
      
      {error && (
        <div className="p-3 text-sm text-red-500 bg-red-100 rounded">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="username" className="block text-sm font-medium text-foreground">
            Username
          </label>
          <input
            type="text"
            id="username"
            value={formData.username}
            onChange={(e) => setFormData({ ...formData, username: e.target.value })}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
            required
          />
        </div>

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-foreground">
            Password
          </label>
          <input
            type="password"
            id="password"
            value={formData.password}
            onChange={(e) => setFormData({ ...formData, password: e.target.value })}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
            required
          />
        </div>

        <div>
          <label htmlFor="name" className="block text-sm font-medium text-foreground">
            Full Name
          </label>
          <input
            type="text"
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
            required
          />
        </div>

        <div>
          <label htmlFor="studentId" className="block text-sm font-medium text-foreground">
            Student ID
          </label>
          <input
            type="text"
            id="studentId"
            value={formData.studentId}
            onChange={(e) => setFormData({ ...formData, studentId: e.target.value })}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
            required
          />
        </div>

        <div>
          <label htmlFor="currentDegree" className="block text-sm font-medium text-foreground">
            Current Degree
          </label>
          <select
            id="currentDegree"
            value={formData.currentDegree}
            onChange={(e) => setFormData({ ...formData, currentDegree: e.target.value })}
            className="mt-1 block w-full rounded-md border border-border bg-background px-3 py-2"
            required
          >
            <option value="">Select a degree</option>
            <option value="cs-degree">Computer Science</option>
            <option value="eng-degree">Engineering</option>
            <option value="math-degree">Mathematics</option>
            {/* Add more degrees as needed */}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-foreground mb-2">
            Degrees of Interest
          </label>
          <div className="space-y-2">
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                value="cs-degree"
                onChange={handleInterestedDegreeChange}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Computer Science</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                value="eng-degree"
                onChange={handleInterestedDegreeChange}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Engineering</span>
            </label>
            <label className="flex items-center space-x-2">
              <input
                type="checkbox"
                value="math-degree"
                onChange={handleInterestedDegreeChange}
                className="rounded border-border"
              />
              <span className="text-sm text-foreground">Mathematics</span>
            </label>
            {/* Add more degrees as needed */}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full py-2 px-4 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition disabled:opacity-50"
        >
          {isLoading ? "Processing..." : "Register"}
        </button>
      </form>

      <div className="text-center text-sm text-foreground">
        Already have an account?{" "}
        <Link href="/login" className="text-primary hover:underline">
          Sign in here
        </Link>
      </div>
    </div>
  )
} 