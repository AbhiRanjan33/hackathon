"use client"

import { useState } from "react"
import { Loader2 } from "lucide-react"
import { useRouter } from "next/navigation"
import { HfInference } from "@huggingface/inference"
import AnalysisLoader from "./AnalysisLoader"

interface VideoDetails {
  title: string
  thumbnail: string
  channel: string
  views: string
  likes: string
  subscribers: string
}

const client = new HfInference("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")

const SentimentForm = () => {
  const [youtubeLink, setYoutubeLink] = useState("")
  const [loading, setLoading] = useState(false)
  const [deepLoading, setDeepLoading] = useState(false)
  const [videoDetails, setVideoDetails] = useState<VideoDetails | null>(null)
  const [confirmed, setConfirmed] = useState(false)
  const router = useRouter()
  const [sentiments, setSentiments] = useState<any[]>([])

  const handleAnalyze = async () => {
    setLoading(true)
    setVideoDetails(null)
    setConfirmed(false)

    const videoId = extractYouTubeVideoId(youtubeLink)
    if (!videoId) {
      alert("Invalid YouTube link.")
      setLoading(false)
      return
    }

    const details = await fetchYouTubeData(videoId)
    if (details) {
      setVideoDetails(details)
    } else {
      alert("Failed to fetch video details.")
    }

    setLoading(false)
  }

  const handleConfirm = async () => {
    setLoading(true)
    setDeepLoading(true)

    try {
      console.log("Sending request to API...")

      // Fetch comments from scraper
      const response = await fetch("https://youtube-scraper-api-service.onrender.com/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: youtubeLink }),
      })

      if (!response.ok) {
        const errorText = await response.text()
        console.error("Server Response:", errorText)
        throw new Error(`Failed to fetch comments: ${response.status}`)
      }

      const data = await response.json()
      console.log("Fetched comments:", data)

      // Send comments to MongoDB
      console.log("Storing comments in MongoDB...")
      const storeResponse = await fetch("/api/storeComments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: data.comments }),
      })

      // ✅ Fetch video transcript using our API
      console.log("🎬 Fetching transcript...")
      const transcriptResponse = await fetch("/api/getTranscript", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ youtubeLink }),
      })

      if (!transcriptResponse.ok) {
        const errorText = await transcriptResponse.text()
        console.error("❌ Transcript API Response:", errorText)
        throw new Error(`Failed to fetch transcript: ${transcriptResponse.status}`)
      }

      const transcriptData = await transcriptResponse.json()
      console.log("✅ Transcript Fetched:", transcriptData)

      console.log("Fetching stored comments...")
      const fetchResponse = await fetch("/api/getComments")
      if (!fetchResponse.ok) throw new Error("Failed to retrieve comments")
      const storedComments = await fetchResponse.json()

      const commentTexts = storedComments.comments.map((comment: any) => comment.text)

      console.log("Running sentiment analysis...")
      const sentiment = await fetch("/api/sentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: commentTexts }),
      })

      console.log("hello")

      const responseText = await sentiment.text() // Capture raw response text

      if (!sentiment.ok) {
        console.error("API Error Response:", responseText)
        throw new Error(`Sentiment analysis failed: ${sentiment.status} - ${responseText}`)
      }

      const sentimentResults = JSON.parse(responseText)
      console.log("Sentiment analysis result:", sentimentResults)

      console.log("Updating comments with sentiment...")
      await fetch("/api/addSentiment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ comments: data.comments, sentimentResults: sentimentResults.results }),
      })

      console.log("Sentiments added to database successfully.")

      console.log("Fetching updated comments from MongoDB...")
      const newResponse = await fetch("/api/textComments")
      if (!newResponse.ok) throw new Error("Failed to retrieve updated comments")
      const updatedComments = await newResponse.json()
      console.log(updatedComments)

      console.log("Computing summary...")
      const summaryResponse = await fetch("/api/summary", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          likes: videoDetails?.likes,
          views: videoDetails?.views,
          commentsDB: updatedComments.comments,
          transcript: transcriptData,
        }),
      })
      if (!summaryResponse.ok) {
        const summaryErrorText = await summaryResponse.text()
        console.error("Summary API Error Response:", summaryErrorText)
        throw new Error(`Summary API failed: ${summaryResponse.status} - ${summaryErrorText}`)
      }
      const summaryData = await summaryResponse.json()
      console.log("Summary Data:", summaryData.summary)

      console.log("🔍 Fetching AI-based video analysis...")
      const aiResponse = await fetch("/api/fetchDeepSeek", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          likes: videoDetails?.likes,
          views: videoDetails?.views,
          commentsDB: storedComments.comments,
          transcript: transcriptData,
        }),
      })

      const aiData = await aiResponse.json()
      console.log("🤖 DeepSeek AI Analysis:", aiData.result)

      router.push("/SummaryDashboard")
    } catch (error) {
      console.error("Error processing comments:", error)
    } finally {
      setLoading(false)
      setDeepLoading(false)
    }
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-black bg-opacity-30 text-purple-200 p-6">
      {deepLoading && <AnalysisLoader />}

      <div className="w-full max-w-md space-y-8">
        <h2 className="text-3xl font-extrabold text-center text-purple-400 glow">YouTube Sentiment Analysis</h2>

        <div className="backdrop-blur-lg bg-purple-900/10 p-8 rounded-2xl shadow-lg border border-purple-500/20">
          <input
            type="text"
            value={youtubeLink}
            onChange={(e) => setYoutubeLink(e.target.value)}
            placeholder="Enter YouTube link"
            className="w-full p-3 bg-black/50 text-purple-200 placeholder-purple-400 rounded-lg border border-purple-500/30 focus:ring-2 focus:ring-purple-500 outline-none transition-all duration-300"
            required
          />
          <button
            onClick={handleAnalyze}
            className="mt-4 w-full flex items-center justify-center gap-2 bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-glow"
            disabled={loading}
          >
            {loading ? <Loader2 className="animate-spin h-5 w-5" /> : "Analyze"}
          </button>
        </div>

        {videoDetails && (
          <div className="mt-8 p-6 bg-purple-900/20 rounded-2xl shadow-lg text-purple-200 text-center border border-purple-500/20">
            <img
              src={videoDetails.thumbnail || "/placeholder.svg"}
              alt="Video Thumbnail"
              className="rounded-lg shadow-md mb-4 mx-auto"
            />
            <h3 className="text-xl font-bold text-purple-300">{videoDetails.title}</h3>
            <p className="text-purple-400">Channel: {videoDetails.channel}</p>
            <p className="text-purple-400">Subscribers: {videoDetails.subscribers}</p>
            <p className="text-purple-400">Views: {videoDetails.views}</p>
            <p className="text-purple-400">Likes: {videoDetails.likes}</p>

            <div className="flex items-center justify-center gap-2 mt-6">
              <input
                type="checkbox"
                id="confirmVideo"
                checked={confirmed}
                onChange={() => setConfirmed(!confirmed)}
                className="w-5 h-5 accent-purple-600"
              />
              <label htmlFor="confirmVideo" className="text-purple-300">
                This is the correct video
              </label>
            </div>

            {confirmed && (
              <button
                onClick={handleConfirm}
                className="mt-6 w-full bg-purple-600 hover:bg-purple-700 text-white font-semibold py-3 px-6 rounded-lg transition-all duration-300 transform hover:scale-105 hover:shadow-glow flex items-center justify-center"
                disabled={deepLoading}
              >
                {deepLoading ? <Loader2 className="animate-spin h-5 w-5" /> : "Proceed to Analysis"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

const extractYouTubeVideoId = (url: string): string | null => {
  const match = url.match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)
  return match ? match[1] : null
}

const fetchYouTubeData = async (videoId: string): Promise<VideoDetails | null> => {
  try {
    const API_KEY = process.env.NEXT_PUBLIC_YOUTUBE_API_KEY

    // Fetch video details
    const videoResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/videos?id=${videoId}&part=snippet,statistics&key=${API_KEY}`,
    )
    const videoData = await videoResponse.json()

    if (videoData.items.length === 0) return null

    const video = videoData.items[0].snippet
    const stats = videoData.items[0].statistics
    const channelId = video.channelId

    // Fetch channel details to get subscriber count
    const channelResponse = await fetch(
      `https://www.googleapis.com/youtube/v3/channels?id=${channelId}&part=statistics&key=${API_KEY}`,
    )
    const channelData = await channelResponse.json()

    let subscribers = "N/A"
    if (channelData.items.length > 0) {
      subscribers = channelData.items[0].statistics.subscriberCount
        ? Number.parseInt(channelData.items[0].statistics.subscriberCount).toLocaleString()
        : "N/A"
    }

    return {
      title: video.title,
      thumbnail: video.thumbnails.high.url,
      channel: video.channelTitle,
      views: stats.viewCount ? Number.parseInt(stats.viewCount).toLocaleString() : "N/A",
      likes: stats.likeCount ? Number.parseInt(stats.likeCount).toLocaleString() : "N/A",
      subscribers,
    }
  } catch (error) {
    console.error("Error fetching YouTube data:", error)
  }
  return null
}

export default SentimentForm

