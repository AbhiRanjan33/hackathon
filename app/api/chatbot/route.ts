import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { Comment } from "@/lib/models/comment";

// Get API key from environment variables
const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY || "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";
const API_URL = "https://openrouter.ai/api/v1/chat/completions";
// Use a model that's definitely available on OpenRouter
const MODEL = "anthropic/claude-3-haiku";

function analyzeSentiment(text: string) {
  // Enhanced sentiment analysis with more comprehensive word lists
  const words = text.toLowerCase().split(/\s+/);
  const positiveWords = new Set([
    'happy', 'great', 'awesome', 'excellent', 'love', 'amazing', 'good', 'best',
    'fantastic', 'perfect', 'wonderful', 'brilliant', 'helpful', 'positive', 'beautiful',
    'excited', 'enjoy', 'like', 'appreciate', 'grateful', 'thanks', 'impressive'
  ]);
  const negativeWords = new Set([
    'sad', 'bad', 'awful', 'terrible', 'hate', 'angry', 'worst', 'poor',
    'horrible', 'disappointed', 'useless', 'waste', 'boring', 'annoying', 'frustrating',
    'difficult', 'stupid', 'ugly', 'confusing', 'ridiculous', 'wrong', 'problem'
  ]);
  
  let positiveCount = 0;
  let negativeCount = 0;
  
  words.forEach(word => {
    if (positiveWords.has(word)) positiveCount++;
    if (negativeWords.has(word)) negativeCount++;
  });
  
  return {
    sentiment: positiveCount > negativeCount ? 'positive' : 
               negativeCount > positiveCount ? 'negative' : 'neutral',
    score: (positiveCount - negativeCount) / words.length,
    details: {
      positive: positiveCount,
      negative: negativeCount,
      total: words.length
    }
  };
}

export async function POST(req: NextRequest) {
  try {
    // Connect to database
    await connectDB();
    
    const { videoId, transcript, question, videoDetails, chatHistory = [], analysis } = await req.json();
    
    if (!question) {
      return NextResponse.json({ error: "No question provided" }, { status: 400 });
    }

    // Check if API key is available
    if (!OPENROUTER_API_KEY) {
      console.error("❌ OpenRouter API key is missing");
      return NextResponse.json({ error: "OpenRouter API key is missing" }, { status: 500 });
    }
    
    let contextData = "";
    let sentimentAnalysis = { overall: 'neutral', score: 0, details: {} };
    let isVideoRelatedQuestion = !!videoId;
    
    // Extract creator information specifically
    let creatorName = "Unknown";
    let videoTitle = "Unknown";
    
    if (videoDetails) {
      if (videoDetails.channel) {
        creatorName = videoDetails.channel;
      }
      if (videoDetails.title) {
        videoTitle = videoDetails.title;
      }
    }
    
    if (videoId) {
      console.log(`🔍 Analyzing video context for videoId: ${videoId}`);
      
      // Highlight creator information at the beginning
      contextData += `\nCURRENT VIDEO INFORMATION:\n`;
      contextData += `- Title: ${videoTitle}\n`;
      contextData += `- Creator: ${creatorName}\n`;
      contextData += `- YouTube ID: ${videoId}\n\n`;
      
      // Fetch and process comments
      const comments = await Comment.find({ videoId }).lean();
      
      if (comments && comments.length > 0) {
        // Analyze sentiment of all comments
        const sentiments = comments.map(comment => analyzeSentiment(comment.text));
        const avgScore = sentiments.reduce((acc, curr) => acc + curr.score, 0) / sentiments.length;
        
        // Count sentiment distributions
        const positiveCounts = sentiments.filter(s => s.sentiment === 'positive').length;
        const negativeCounts = sentiments.filter(s => s.sentiment === 'negative').length;
        const neutralCounts = sentiments.filter(s => s.sentiment === 'neutral').length;
        
        sentimentAnalysis = {
          overall: avgScore > 0.1 ? 'positive' : avgScore < -0.1 ? 'negative' : 'neutral',
          score: avgScore,
          details: {
            positive: positiveCounts,
            negative: negativeCounts,
            neutral: neutralCounts,
            total: comments.length
          }
        };
        
        // Select representative comments (mix of positive and negative)
        const positiveComments = comments
          .filter(comment => analyzeSentiment(comment.text).sentiment === 'positive')
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 15);
          
        const negativeComments = comments
          .filter(comment => analyzeSentiment(comment.text).sentiment === 'negative')
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 15);
          
        const neutralComments = comments
          .filter(comment => analyzeSentiment(comment.text).sentiment === 'neutral')
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 10);
        
        const representativeComments = [...positiveComments, ...negativeComments, ...neutralComments]
          .sort((a, b) => b.votes - a.votes)
          .slice(0, 40);
        
        const commentExamples = representativeComments.map(comment => 
          `- "${comment.text}" (Likes: ${comment.votes}, Sentiment: ${analyzeSentiment(comment.text).sentiment})`
        ).join("\n");
        
        contextData += `\nCOMMENTS ANALYSIS:\n`;
        contextData += `- Total comments analyzed: ${comments.length}\n`;
        contextData += `- Overall sentiment: ${sentimentAnalysis.overall}\n`;
        contextData += `- Sentiment score: ${sentimentAnalysis.score.toFixed(2)}\n`;
        contextData += `- Positive comments: ${positiveCounts} (${((positiveCounts / comments.length) * 100).toFixed(1)}%)\n`;
        contextData += `- Negative comments: ${negativeCounts} (${((negativeCounts / comments.length) * 100).toFixed(1)}%)\n`;
        contextData += `- Neutral comments: ${neutralCounts} (${((neutralCounts / comments.length) * 100).toFixed(1)}%)\n\n`;
        contextData += `\nREPRESENTATIVE COMMENTS:\n${commentExamples}\n\n`;
      }
      
      // Process transcript data
      if (transcript) {
        const transcriptSentiment = analyzeSentiment(transcript);
        
        // Extract potential key segments from transcript (first, middle, and last parts)
        const words = transcript.split(' ');
        const firstSegment = words.slice(0, 200).join(' ');
        const middleIndex = Math.floor(words.length / 2);
        const middleSegment = words.slice(middleIndex - 100, middleIndex + 100).join(' ');
        const lastSegment = words.slice(-200).join(' ');
        
        contextData += `\nTRANSCRIPT ANALYSIS:\n`;
        contextData += `- Sentiment: ${transcriptSentiment.sentiment}\n`;
        contextData += `- Score: ${transcriptSentiment.score.toFixed(2)}\n`;
        contextData += `- Word count: ${words.length}\n\n`;
        contextData += `\nKEY TRANSCRIPT SEGMENTS:\n`;
        contextData += `BEGINNING:\n${firstSegment}\n\n`;
        contextData += `MIDDLE SECTION:\n${middleSegment}\n\n`;
        contextData += `ENDING:\n${lastSegment}\n\n`;
      }
      
      if (analysis) {
        contextData += `\nAI ANALYSIS OF VIDEO CONTENT:\n${analysis}\n\n`;
      }
      
      if (videoDetails) {
        contextData += `\nADDITIONAL VIDEO DETAILS:\n`;
        contextData += `- Views: ${videoDetails.views || "Unknown"}\n`;
        contextData += `- Likes: ${videoDetails.likes || "Unknown"}\n`;
        contextData += `- Subscribers: ${videoDetails.subscribers || "Unknown"}\n\n`;
      }
    }
    
    // Create context-setting first message
    let contextMessage = isVideoRelatedQuestion ? {
      role: "assistant",
      content: `I'll help you with your questions about the YouTube video "${videoTitle}" by ${creatorName} (ID: ${videoId}).`
    } : null;
    
    // Enhanced system prompt that handles both video-related and general queries
    const systemPrompt = isVideoRelatedQuestion ? 
      `You are an AI assistant specialized in analyzing YouTube videos, their content, and creator mental health.

IMPORTANT CONTEXT: The user is asking about the YouTube video titled "${videoTitle}" created by ${creatorName} (Video ID: ${videoId}).

CRITICAL INSTRUCTION: Always refer to the specific video context provided below. DO NOT give generic responses about video content in general. When the user asks about "video content" or "my video", they are SPECIFICALLY referring to "${videoTitle}" by ${creatorName}.

Always remember that:
1. "The video" or "this video" refers specifically to "${videoTitle}" by ${creatorName}
2. "The creator" or "content creator" or similar phrases refer to ${creatorName}
3. When asked to summarize the video, provide a summary of "${videoTitle}" based on the transcript
4. When asked about the channel, refer to ${creatorName}'s channel
5. NEVER give generic responses about video content creation when the user is asking about the specific video

You have access to video transcripts, comments with sentiment analysis, and other metadata. Your role is to:
1. Provide insights about the content creator's emotional state and mental well-being based on their speech patterns and content
2. Analyze audience reception through comment sentiment analysis
3. Describe the overall video mood, tone, and key points
4. Identify potential stress, burnout, or health indicators in the creator's presentation
5. Highlight positive community interactions and support patterns

When analyzing questions:
- For questions about THIS specific video, use the provided context information
- For general questions unrelated to the video, answer from your general knowledge
- For questions about YouTube, content creation, or mental health in general, provide helpful information without needing context

IMPORTANT: Even vague queries like "video content" or "my video" should be interpreted as referring to "${videoTitle}" by ${creatorName}. Do not give generic responses about video content in general.

Keep responses concise but informative. Use data from comments and transcript when available.` :
      `You are an AI assistant that helps with general questions. Provide informative, helpful, and friendly responses. If the question isn't about a specific YouTube video, you'll answer based on your general knowledge.`;
    
    // Build the messages array with the context
    let messages = [
      {
        role: "system",
        content: systemPrompt
      }
    ];
    
    // Add the context-setting first message if it exists and there is no chat history
    if (contextMessage && chatHistory.length === 0) {
      messages.push(contextMessage);
    }
    
    // Add the chat history
    messages = [
      ...messages,
      ...chatHistory.map((msg: any) => ({
        role: msg.role,
        content: msg.content
      }))
    ];
    
    // Add the current question with context
    messages.push({
      role: "user",
      content: isVideoRelatedQuestion ? 
        `${question}\n\nReference context about the video "${videoTitle}" by ${creatorName}:\n${contextData}` :
        question
    });

    console.log(`🤖 Generating response with ${MODEL}...`);
    
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://youtube-analyzer.com',
        'X-Title': 'YouTube Analytics Assistant'
      },
      body: JSON.stringify({
        model: MODEL,
        messages,
        temperature: 0.7,  // Slightly increased for more varied responses
        max_tokens: 1500
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`❌ OpenRouter API error: ${errorText}`);
      return NextResponse.json({ error: `Failed to get response: ${errorText}` }, { status: response.status });
    }

    const result = await response.json();
    const aiResponse = result.choices?.[0]?.message?.content || "I couldn't generate a response at this time.";
    
    console.log("✅ Response generated successfully");
    
    return NextResponse.json({ 
      response: aiResponse,
      hasVideoContext: !!contextData,
      sentimentAnalysis,
      model: "Claude 3 Haiku",
      creatorName,
      videoTitle,
      videoId
    });
    
  } catch (error) {
    console.error("Error generating response:", error);
    return NextResponse.json(
      { error: (error as Error).message || "Failed to generate response" },
      { status: 500 }
    );
  }
} 