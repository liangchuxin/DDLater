import mongoose from "mongoose";

const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  hash: String,
  courses: [{ type: mongoose.Schema.Types.ObjectId, ref: "Course" }],
  badges: [String],
});

const AvatarSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    name: { type: String, default: "My Character" },
    sourceImageUrl: String,
    avatarGrid: { type: [[]], required: true },
    avatarCuts: { type: [Number], required: true },
  },
  { timestamps: true }
);

const ProfileSchema = new mongoose.Schema(
  {
    user: { type: mongoose.Schema.Types.ObjectId, ref: "User", unique: true },
    displayName: String,
    uid: { type: String, unique: true },
    avatar: String,
    activeAvatar: { type: mongoose.Schema.Types.ObjectId, ref: "Avatar", default: null },
    school: String,
    graduationYear: Number,
    major: String,
  },
  { timestamps: true },
);

const CourseSchema = new mongoose.Schema({
  courseCode: { type: String, required: true },
  courseName: String,
  school: { type: String, required: true },
  semester: String,
  year: Number,
});

const TaskSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  course: { type: mongoose.Schema.Types.ObjectId, ref: "Course" },
  title: { type: String, required: true },
  description: String,
  dueDate: Date,
  progressNumerator: { type: Number, default: 0 },
  progressDenominator: { type: Number, default: 1 },
  hideFromClassmates: { type: Boolean, default: false },
});

const StudyRoomSchema = new mongoose.Schema({
  uid: { type: String, unique: true },
  name: String,
  owner: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  members: [{
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    tasks: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Task' }],
  }],
  pendingMembers: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
});

mongoose.model("User", UserSchema);
mongoose.model("Avatar", AvatarSchema);
mongoose.model("Profile", ProfileSchema);
mongoose.model("Course", CourseSchema);
mongoose.model("Task", TaskSchema);
mongoose.model("StudyRoom", StudyRoomSchema);
