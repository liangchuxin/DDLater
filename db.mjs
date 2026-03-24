import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  hash: String, // a password hash
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }], // references to Course documents
  badges: [String],
});

const CourseSchema = new mongoose.Schema({
  courseCode: { type: String, required: true }, // e.g. "CSCI-UA 474"
  courseName: String,
  school: { type: String, required: true },
  semester: String,
  year: Number,
});

const TaskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" }, // optional
  title: { type: String, required: true },
  description: String,
  dueDate: Date,
  progressNumerator: { type: Number, default: 0 },
  progressDenominator: { type: Number, default: 1 }, // progress = numerator / denominator
  hideFromClassmates: { type: Boolean, default: false },
});

const StudyRoomSchema = new mongoose.Schema({
  name: String,
  members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }], // references to User documents
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});

mongoose.model("User", UserSchema);
mongoose.model("Course", CourseSchema);
mongoose.model("Task", TaskSchema);
mongoose.model("StudyRoom", StudyRoomSchema);
