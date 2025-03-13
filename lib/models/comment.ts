import mongoose from "mongoose";

const CommentSchema = new mongoose.Schema({
    text: { type: String, required: true },
    votes: { type: Number, required: true, default: 0 },
    hearted: { type: Boolean, required: true, default: false },
    replies: { type: Number, required: true, default: 0 },
    time: { type: Date, required: true },  // Changed to Date
    sentiment: { type: String, enum: ["Positive", "Negative", "Neutral"], default: "Neutral" }, // Added sentiment field
});

CommentSchema.pre('save', function(next) {
    this.votes = Number(this.votes) || 0;
    this.replies = Number(this.replies) || 0;
    this.time = this.time ? new Date(this.time).toISOString() : new Date().toISOString();  // Ensure time is valid
    next();
});

export const Comment = mongoose.models.Comment || mongoose.model("Comment", CommentSchema);
