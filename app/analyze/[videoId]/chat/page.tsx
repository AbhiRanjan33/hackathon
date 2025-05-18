"use client";

import { useState, useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Send, ArrowLeft, MessageSquare } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

interface VideoComment {
  text: string;
  votes: number;
  time: string;
}

export default function VideoChatPage() {
  const searchParams = useSearchParams();
  const videoId = searchParams.get("videoId");
  const [input, setInput] = useState("");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [videoDetails, setVideoDetails] = useState<any | null>(null);
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [comments, setComments] = useState<VideoComment[]>([]);
  const [analysis, setAnalysis] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchVideoContext = async () => {
      try {
        // Fetch video details
        const detailsResponse = await fetch(`/api/videoDetails?videoId=${videoId}`);
        if (detailsResponse.ok) {
          const details = await detailsResponse.json();
          setVideoDetails(details);
          console.log("Video details loaded:", details.title);
        }

        // Fetch transcript
        const transcriptResponse = await fetch("/api/getTranscript", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ videoId }),
        });

        if (transcriptResponse.ok) {
          const data = await transcriptResponse.json();
          setTranscript(data.fullText);
          console.log("Transcript loaded");
        }
        
        // Fetch comments for additional context
        try {
          const commentsResponse = await fetch(`/api/fetch-comments?videoId=${videoId}`);
          if (commentsResponse.ok) {
            const commentsData = await commentsResponse.json();
            if (commentsData.comments) {
              setComments(commentsData.comments);
              console.log(`Loaded ${commentsData.comments.length} comments`);
            }
          }
        } catch (commentsError) {
          console.error("Error fetching comments:", commentsError);
        }
        
        // Fetch video analysis if available
        try {
          const analysisResponse = await fetch(`/api/analyze?videoId=${videoId}`);
          if (analysisResponse.ok) {
            const analysisData = await analysisResponse.json();
            if (analysisData.analysis) {
              setAnalysis(analysisData.analysis);
              console.log("Analysis loaded");
            }
          }
        } catch (analysisError) {
          console.error("Error fetching analysis:", analysisError);
        }
        
      } catch (error) {
        console.error("Error fetching context:", error);
      } finally {
        setInitialLoading(false);
        // Add a welcome message
        setChatHistory([
          {
            role: "assistant",
            content: "Hi! I'm your AI assistant trained on this video's content. Ask me anything about the video, the creator's sentiment, or audience reception. I can also answer general questions unrelated to the video!",
          },
        ]);
      }
    };

    if (videoId) {
      fetchVideoContext();
    } else {
      setInitialLoading(false);
      setChatHistory([
        {
          role: "assistant",
          content: "Welcome! I don't have a specific video context loaded. What would you like to talk about?",
        },
      ]);
    }
  }, [videoId]);

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage: ChatMessage = { role: "user", content: input.trim() };
    setChatHistory((prev) => [...prev, userMessage]);
    setInput("");
    setLoading(true);

    try {
      const response = await fetch("/api/chatbot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          videoId,
          transcript,
          videoDetails,
          question: userMessage.content,
          chatHistory: chatHistory,
          analysis: analysis
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to get response");
      }

      const data = await response.json();
      
      const aiMessage: ChatMessage = {
        role: "assistant",
        content: data.response,
      };

      setChatHistory((prev) => [...prev, aiMessage]);
    } catch (error) {
      console.error("Error:", error);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error processing your request. Please try again.",
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  if (initialLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-background">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Loading video context...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col min-h-screen bg-background text-foreground">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <Link
            href={`/analyze/${videoId}`}
            className="inline-flex items-center text-primary hover:text-primary/80 transition-colors"
          >
            <ArrowLeft className="h-5 w-5 mr-2" />
            Back to Analysis
          </Link>
          {videoDetails && (
            <div className="truncate max-w-sm">
              <span className="text-muted-foreground text-sm mr-2">Chatting about:</span>
              <span className="font-medium">{videoDetails.title}</span>
            </div>
          )}
        </div>
      </div>

      {/* Chat container */}
      <div className="flex-1 overflow-y-auto p-4">
        <div className="max-w-4xl mx-auto space-y-6 pb-24">
          {chatHistory.map((message, index) => (
            <div
              key={index}
              className={`flex ${
                message.role === "user" ? "justify-end" : "justify-start"
              }`}
            >
              <div
                className={`max-w-[80%] rounded-xl p-4 ${
                  message.role === "user"
                    ? "bg-primary text-primary-foreground"
                    : "bg-card border border-border"
                }`}
              >
                <p className="whitespace-pre-wrap">{message.content}</p>
              </div>
            </div>
          ))}
          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Input form */}
      <div className="border-t border-border p-4 bg-background/80 backdrop-blur-sm fixed bottom-0 left-0 right-0">
        <form onSubmit={handleSubmit} className="max-w-4xl mx-auto flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            disabled={loading}
            placeholder="Ask specifically about this video, its content, audience sentiment, or the creator..."
            className="flex-1 border border-border bg-background p-3 rounded-full focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-primary text-primary-foreground p-3 rounded-full hover:bg-primary/90 disabled:opacity-60 transition-colors"
          >
            {loading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </form>
        
        {/* Context indicator */}
        {videoDetails && (
          <div className="max-w-4xl mx-auto mt-2 text-xs text-muted-foreground flex items-center">
            <MessageSquare className="h-3 w-3 mr-1" />
            <span>
              Using context from: {transcript ? "✓ Transcript" : "✗ No transcript"} • 
              {comments.length > 0 ? ` ✓ ${comments.length} Comments` : " ✗ No comments"} •
              {analysis ? " ✓ Content Analysis" : " ✗ No analysis"}
            </span>
          </div>
        )}
      </div>
    </div>
  );
} 