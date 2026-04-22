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

// 家具类型定义。zSlot 控制渲染层级，layout 存所有视觉参数。
const FurnitureSchema = new mongoose.Schema({
  key:       { type: String, required: true, unique: true }, // 'desk' | 'bed' | 'bean_bag' | 'sofa'
  name:      String,
  capacity:  { type: Number, default: 1 },
  layers:    { type: Number, default: 1 },
  zSlot:     { type: String, default: 'char-back' },  // 'char-back' | 'char-front' | 'char-middle'
  layout:    { type: mongoose.Schema.Types.Mixed, default: {} },  // per-furniture 视觉参数 (px @ CANVAS_REF)
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
  // 背景图设置：只有 owner 能改。图文件放 client/public/room/backgrounds/ 下，key 存文件名。
  background: {
    key: { type: String, default: 'bg-ai-wide.png' },
    heightPct: { type: Number, default: 200 },
    offsetX: { type: Number, default: 0 },
    offsetY: { type: Number, default: -360 },
  },
  // 不空时限定这些 family中的家具（存 furniture.key）；空 = 全部可选
  furnitures: [String],
  createdAt: { type: Date, default: Date.now },
  active: { type: Boolean, default: true },
  // 当前 session 开始时间。room active 后第一个用户 socket connect 时打点；
  // room 变为 inactive 或 所有人离线 时清零
  sessionStartAt: { type: Date, default: null },
});

mongoose.model("User", UserSchema);
mongoose.model("Avatar", AvatarSchema);
mongoose.model("Profile", ProfileSchema);
mongoose.model("Course", CourseSchema);
mongoose.model("Task", TaskSchema);
mongoose.model("Furniture", FurnitureSchema);
mongoose.model("StudyRoom", StudyRoomSchema);

// 房间事件流。所有需要出现在 history 的动作都 insert 一条。
// type 决定前端如何渲染。payload 存 type 专属数据（taskTitle、targetUserId 等）。
const RoomEventSchema = new mongoose.Schema({
  room:    { type: mongoose.Schema.Types.ObjectId, ref: 'StudyRoom', required: true, index: true },
  type:    { type: String, required: true },
  // 'join_request' | 'join_approved' | 'join_rejected' | 'member_joined'
  // | 'leave' | 'task_add' | 'task_remove' | 'task_complete'
  actor:   { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  payload: { type: mongoose.Schema.Types.Mixed, default: {} },
  // 用于 join_request：被 approve/reject 后打标记，前端不再显示 Approve 按钮
  resolvedAt: { type: Date, default: null },
  createdAt:  { type: Date, default: Date.now, index: true },
});
mongoose.model("RoomEvent", RoomEventSchema);
