"use client"

import { useEffect, useState } from "react"
import { Loader2 } from "lucide-react"
import Link from "next/link"

const AIAnalysisPage = () => {
  const [analysis, setAnalysis] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchAnalysis = async () => {
      try {
        const response = await fetch("/api/fetchDeepSeek")

        if (!response.ok) {
          throw new Error(`API Error: ${response.statusText}`)
        }

        const data = await response.json()
        if (data.error) throw new Error(data.error)

        setAnalysis(data.result)
      } catch (err: any) {
        setError(err.message)
      } finally {
        setLoading(false)
      }
    }

    fetchAnalysis()
  }, [])

  return (
    <div className="min-h-screen flex items-center justify-center bg-black bg-opacity-30 text-purple-200 p-6 animated-bg">
      <div className="w-full max-w-3xl bg-black bg-opacity-80 shadow-2xl rounded-xl p-8 border border-purple-500">
        <h1 className="text-4xl font-extrabold text-center text-purple-400 mb-6 glow">🎯 AI-Powered Analysis</h1>

        {loading && (
          <div className="flex flex-col items-center justify-center space-y-4">
            <Loader2 className="w-12 h-12 text-purple-500 animate-spin" />
            <p className="text-lg text-purple-300 text-center animate-pulse">Fetching AI Analysis...</p>
          </div>
        )}

        {error && <p className="text-lg text-red-400 text-center font-medium">❌ Error: {error}</p>}

        {analysis && (
          <div className="mt-6 p-6 border border-purple-600 rounded-lg bg-black bg-opacity-50 shadow-md">
            <h2 className="text-2xl font-semibold text-purple-400 mb-4 glow">📊 AI Analysis Output</h2>
            <pre className="whitespace-pre-wrap text-purple-200 text-lg leading-relaxed overflow-auto max-h-96 scrollbar-thin scrollbar-thumb-purple-500 scrollbar-track-black">
              {analysis}
            </pre>
          </div>
        )}

        {!loading && !error && !analysis && (
          <p className="text-lg text-purple-300 text-center">No analysis data available.</p>
        )}

        {/* Link to Summary Dashboard */}
        <div className="mt-10 text-center">
          <Link href="/SummaryDashboard" className="block text-purple-300 text-lg hover:text-purple-500 transition duration-300">
            Back to Summary Dashboard
          </Link>
        </div>

        {/* Link to Home Page */}
        <div className="mt-6 text-center">
          <Link href="/" className="block text-purple-300 text-lg hover:text-purple-500 transition duration-300">
            Try For Another YouTube Video
          </Link>
        </div>
      </div>
    </div>
  )
}

export default AIAnalysisPage
