import { NextRequest, NextResponse } from "next/server";
import { connectDB } from "@/lib/mongo";
import { Comment } from "@/lib/models/comment";

// Function to remove HTML tags safely
// Function to remove HTML tags safely
function stripHtml(html?: string) {
    if (!html) return ""; // Return empty string if undefined or null
    return html.replace(/<[^>]+>/g, "").trim();
  }

export async function POST(req: NextRequest) {
  try {
    await connectDB(); // Ensure MongoDB connection

    const { comments } = await req.json();
    console.log("Received Data:", comments);

    if (!Array.isArray(comments) || comments.length === 0) {
      return NextResponse.json({ error: "Invalid or empty comments array" }, { status: 400 });
    }

    // Delete old comments before inserting new ones
    await Comment.deleteMany({});

    // Format and validate comments
    const formattedComments = comments.map(comment => {
      if (!comment.text || !comment.time) {
        throw new Error("Each comment must have a 'text' and 'time' field.");
      }

      return {
        text: stripHtml(comment.text), // Clean the text
        votes: Number(comment.votes) || 0, // Default: 0
        hearted: Boolean(comment.hearted), // Default: false
        replies: Number(comment.replies) || 0, // Default: 0
        time: new Date(comment.time), // Ensure valid Date object
      };
    });

    console.log(formattedComments);

    // Insert new comments
    await Comment.insertMany(formattedComments);

    return NextResponse.json({ message: "Comments stored successfully!" }, { status: 201 });

  } catch (error) {
    console.error("❌ Error storing comments:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
