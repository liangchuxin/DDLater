import "./config.mjs";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import "./db.mjs";
import authRouter from './routes/auth.mjs';
import profileRouter from './routes/profile.mjs';
import tasksRouter from './routes/tasks.mjs';
import roomsRouter from './routes/rooms.mjs';
import avatarsRouter from './routes/avatars.mjs';
import furnituresRouter from './routes/furnitures.mjs';

mongoose.connect(process.env.DSN).then(() => console.log("mongodb connected"));

const app = express();

app.set('trust proxy', 1);
console.log('NODE_ENV:', process.env.NODE_ENV);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '10mb' }));

// 把 session middleware 抽成变量，HTTP 和 socket 共享同一份
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.DSN }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax',
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
app.use(sessionMiddleware);

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/avatars', avatarsRouter);
app.use('/api/furnitures', furnituresRouter);

app.get('/api/universities', async (req, res) => {
  const { name } = req.query;
  const response = await fetch(`http://universities.hipolabs.com/search?name=${encodeURIComponent(name)}&country=United+States`);
  const data = await response.json();
  return res.json(data);
});

app.get('/api/courses/search', async (req, res) => {
  if (!req.session.userId) return res.status(401).json({ error: 'Not logged in.' });
  const { q, school } = req.query;
  const Course = mongoose.model('Course');
  const filter = {};
  if (school) filter.school = school;
  if (q) filter.courseCode = { $regex: q, $options: 'i' };
  const courses = await Course.find(filter).limit(8);
  return res.json(courses);
});

app.get("/api/test", (req, res) => res.json({ message: "ok" }));

// ── Socket.io 集成 ──────────────────────────────────────────────────────────
// 用 http.createServer 包住 Express app，让 socket.io 能共用同一个端口。
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
});

// 让 socket 读同一份 express-session cookie。这样 socket.request.session.userId
// 和 HTTP 请求里的 req.session.userId 是同一个值。
io.engine.use(sessionMiddleware);

// 把 io 挂到 app 上，routes 里可以用 req.app.get('io') 拿到并广播事件
app.set('io', io);

io.on('connection', (socket) => {
  const userId = socket.request.session?.userId;
  if (!userId) {
    socket.disconnect();
    return;
  }

  // 记住这个 socket 订阅了哪些 room，断开时都要处理。
  // 可能一个用户多 tab 开同一 room，每个 tab 一个 socket。
  socket.data.joinedRooms = new Set();

  // 自动进入个人 channel，用于接收针对本人的通知（比如 join_rejected）
  socket.join(`user:${userId}`);

  socket.on('join-room', async (roomUid) => {
    if (typeof roomUid !== 'string') return;
    socket.join(`room:${roomUid}`);
    socket.data.joinedRooms.add(roomUid);
    await onUserPresent(roomUid, userId, io);
  });

  socket.on('leave-room', async (roomUid) => {
    if (typeof roomUid !== 'string') return;
    socket.leave(`room:${roomUid}`);
    socket.data.joinedRooms.delete(roomUid);
    await onUserMaybeAbsent(roomUid, userId, io);
  });

  socket.on('disconnect', async () => {
    for (const roomUid of socket.data.joinedRooms) {
      await onUserMaybeAbsent(roomUid, userId, io);
    }
  });
});

// ── Presence 管理（in-memory） ─────────────────────────────────────────────
// roomUid -> Map<userId, socketCount>
// 同 user 多 tab 连同 room 时计数，只有计数归 0 才算离线。
// 服务器重启会丢状态，第一个客户端 join-room 时重建。
const presenceByRoom = new Map();

function getPresenceMap(roomUid) {
  if (!presenceByRoom.has(roomUid)) presenceByRoom.set(roomUid, new Map());
  return presenceByRoom.get(roomUid);
}

async function onUserPresent(roomUid, userId, io) {
  const map = getPresenceMap(roomUid);
  const prevCount = map.get(userId) ?? 0;
  map.set(userId, prevCount + 1);

  // 首次上线（这个 user 之前没在线）才做全局操作（开 session）
  if (prevCount === 0) {
    const onlineUsers = [...map.keys()];
    // 如果是房间里第一个在线的人，开始 session 计时
    if (onlineUsers.length === 1) {
      const StudyRoom = mongoose.model('StudyRoom');
      const room = await StudyRoom.findOne({ uid: roomUid });
      if (room && room.active && !room.sessionStartAt) {
        room.sessionStartAt = new Date();
        await room.save();
        io.to(`room:${roomUid}`).emit('session-start', {
          sessionStartAt: room.sessionStartAt,
        });
      }
    }
  }

  // 无论是首次还是额外 tab，都广播一次 presence 列表 ——
  // 这样新 tab 能拿到最新状态，旧的 tab 收到会刀重复也不是问题
const onlineUsers = [...map.keys()];
  io.to(`room:${roomUid}`).emit('presence', { online: onlineUsers });

  // 对新连上的 socket 独单发一份当前 session 状态（如果现有 session 正在进行，
  // 新 tab 需要知道 sessionStartAt）。但这里没 socket 引用，改成广播也行
  const StudyRoom2 = mongoose.model('StudyRoom');
  const room2 = await StudyRoom2.findOne({ uid: roomUid }, 'sessionStartAt');
  if (room2?.sessionStartAt) {
    io.to(`room:${roomUid}`).emit('session-start', {
      sessionStartAt: room2.sessionStartAt,
    });
  }
}

async function onUserMaybeAbsent(roomUid, userId, io) {
  const map = getPresenceMap(roomUid);
  const prevCount = map.get(userId) ?? 0;
  if (prevCount <= 1) {
    map.delete(userId);
  } else {
    map.set(userId, prevCount - 1);
    return; // 还有其他 tab，不算真离线
  }

  const onlineUsers = [...map.keys()];
  io.to(`room:${roomUid}`).emit('presence', { online: onlineUsers });

  // 所有人都下线了，清 session
  if (onlineUsers.length === 0) {
    const StudyRoom = mongoose.model('StudyRoom');
    const room = await StudyRoom.findOne({ uid: roomUid });
    if (room && room.sessionStartAt) {
      room.sessionStartAt = null;
      await room.save();
      io.to(`room:${roomUid}`).emit('session-end');
    }
  }
}

httpServer.listen(process.env.PORT ?? 3000, () => console.log("server running"));
