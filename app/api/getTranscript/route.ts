import { NextResponse } from "next/server";
import { YoutubeTranscript } from "youtube-transcript";

// ✅ Main API handler
export async function POST(req: Request) {
  try {
    // Parse request body
    const body = await req.json();
    console.log("📥 Received transcript request:", body); // Debugging log

    // Validate `youtubeLink`
    const youtubeLink = body.youtubeLink;
    if (!youtubeLink) {
      console.error("❌ Missing YouTube link in request body");
      return NextResponse.json({ error: "Missing YouTube link" }, { status: 400 });
    }

    // Extract Video ID from YouTube URL
    const videoId = extractVideoId(youtubeLink);
    if (!videoId) {
      console.error("❌ Invalid YouTube URL:", youtubeLink);
      return NextResponse.json({ error: "Invalid YouTube URL" }, { status: 400 });
    }

    console.log("🔍 Fetching transcript for Video ID:", videoId);

    // Fetch transcript
    const transcript = await fetchTranscriptServerSide(videoId);
    if (!transcript) {
      console.error("❌ Failed to fetch transcript");
      return NextResponse.json({ error: "Failed to fetch transcript" }, { status: 500 });
    }

    // Convert transcript to a full text block
    const fullText = transcript.map(entry => entry.text).join(" ");
    console.log("📜 Full Transcript Text:", fullText);

    // ✅ Success response
    return NextResponse.json(
      { videoId, transcript, fullText },
      {
        status: 200,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Methods": "POST, OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type",
        },
      }
    );
  } catch (error) {
    console.error("🚨 Transcript Fetch Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// ✅ Extract Video ID from YouTube URL
function extractVideoId(url: string): string | null {
  const match = url.match(/(?:youtube\.com\/(?:[^/]+\/.*|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
  return match ? match[1] : null;
}

// ✅ Fetch transcript while handling errors
async function fetchTranscriptServerSide(videoId: string) {
  try {
    const transcript = await YoutubeTranscript.fetchTranscript(videoId);
    return transcript;
  } catch (error) {
    console.error("🚨 Error fetching transcript:", error);
    return null;
  }
}
