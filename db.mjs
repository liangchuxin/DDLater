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
    isDefault: { type: Boolean, default: false },
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

// Furniture type definition. zSlot controls render layer; layout holds all visual params.
const FurnitureSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true }, // 'desk' | 'bed' | 'bean_bag' | 'sofa'
  name:      String,
  capacity:  { type: Number, default: 1 },
  layers:    { type: Number, default: 1 },
  zSlot:     { type: String, default: 'char-back' },  // 'char-back' | 'char-front' | 'char-middle'
  layout:    { type: mongoose.Schema.Types.Mixed, default: {} },  // per-furniture visual params (px @ CANVAS_REF)
  imageKeys: [String],
  isDefault: { type: Boolean, default: false },
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
  // Background settings. Owner-only edit. Image files live in client/public/room/backgrounds/; key stores the filename.
  background: {
    key: { type: String, default: 'bg-ai-wide.png' },
    heightPct: { type: Number, default: 200 },
    offsetX: { type: Number, default: 0 },
    offsetY: { type: Number, default: -360 },
  },
  // When non-empty, restricts to these furniture keys; empty = all furnitures available.
  furnitures: [String],
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  // Start time of the current session. Set when the first user's socket connects after the room goes active;
  // cleared when the room becomes inactive or everyone is offline.
  sessionStartAt: { type: Date, default: null },
});

mongoose.model("User", UserSchema);
mongoose.model("Avatar", AvatarSchema);
mongoose.model("Profile", ProfileSchema);
mongoose.model("Course", CourseSchema);
mongoose.model("Task", TaskSchema);
mongoose.model("Furniture", FurnitureSchema);
mongoose.model("StudyRoom", StudyRoomSchema);

// Room event stream. Every action that needs to appear in history inserts one.
// type drives frontend rendering; payload stores type-specific data (taskTitle, targetUserId, etc).
const RoomEventSchema = new mongoose.Schema({
  room:    { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRoom', required: true, index: true },
  type:    { type: String, required: true },
  // 'join_request' | 'join_approved' | 'join_rejected' | 'member_joined'
  // | 'leave' | 'task_add' | 'task_remove' | 'task_complete'
  actor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  // For join_request: set after approve/reject so the frontend stops showing action buttons.
  resolvedAt: { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now, index: true },
});
mongoose.model("RoomEvent", RoomEventSchema);
