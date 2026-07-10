import "./config.mjs";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import { createServer } from "http";
import { Server as SocketIOServer } from "socket.io";
import "./db.mjs";
import authRouter from "./routes/auth.mjs";
import profileRouter from "./routes/profile.mjs";
import tasksRouter from "./routes/tasks.mjs";
import roomsRouter from "./routes/rooms.mjs";
import avatarsRouter from "./routes/avatars.mjs";
import furnituresRouter from "./routes/furnitures.mjs";
import userFurnitureRouter from "./routes/userFurniture.mjs";

mongoose.connect(process.env.DSN).then(() => console.log("mongodb connected"));

const app = express();

app.set("trust proxy", 1);
console.log("NODE_ENV:", process.env.NODE_ENV);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(",")
  : [];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true,
};

app.use(cors(corsOptions));
app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: "25mb" }));

// Session middleware as a variable so it can be shared by both HTTP and socket.
const sessionMiddleware = session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({ mongoUrl: process.env.DSN }),
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 1000 * 60 * 60 * 24 * 7,
  },
});
app.use(sessionMiddleware);

app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/tasks", tasksRouter);
app.use("/api/rooms", roomsRouter);
app.use("/api/avatars", avatarsRouter);
app.use("/api/furnitures", furnituresRouter);
app.use("/api/me/furniture", userFurnitureRouter);

app.get("/api/universities", async (req, res) => {
  const { name } = req.query;
  const response = await fetch(
    `http://universities.hipolabs.com/search?name=${encodeURIComponent(name)}&country=United+States`,
  );
  const data = await response.json();
  return res.json(data);
});

app.get("/api/courses/search", async (req, res) => {
  if (!req.session.userId)
    return res.status(401).json({ error: "Not logged in." });
  const { q, school } = req.query;
  const Course = mongoose.model("Course");
  const filter = {};
  if (school) filter.school = school;
  if (q) filter.courseCode = { $regex: q, $options: "i" };
  const courses = await Course.find(filter).limit(8);
  return res.json(courses);
});

app.get("/api/test", (req, res) => res.json({ message: "ok" }));

// Socket.io integration.
// Wrap Express in http.createServer so socket.io can share the same port.
const httpServer = createServer(app);

const io = new SocketIOServer(httpServer, {
  cors: corsOptions,
});

// Let socket.io read the same express-session cookie, so socket.request.session.userId
// matches req.session.userId on HTTP requests.
io.engine.use(sessionMiddleware);

// Expose io on the app so routes can do req.app.get('io') to broadcast.
app.set("io", io);

io.on("connection", (socket) => {
  const userId = socket.request.session?.userId;
  if (!userId) {
    socket.disconnect();
    return;
  }

  // Track which rooms this socket has joined so we clean up on disconnect.
  // A single user may have multiple tabs open in the same room, each with its own socket.
  socket.data.joinedRooms = new Set();

  // Auto-join a personal channel for notifications targeted at this user (e.g. join_rejected).
  socket.join(`user:${userId}`);

  socket.on("join-room", async (roomUid) => {
    if (typeof roomUid !== "string") return;
    socket.join(`room:${roomUid}`);
    socket.data.joinedRooms.add(roomUid);
    await onUserPresent(roomUid, userId, io);
  });

  socket.on("leave-room", async (roomUid) => {
    if (typeof roomUid !== "string") return;
    socket.leave(`room:${roomUid}`);
    socket.data.joinedRooms.delete(roomUid);
    await onUserMaybeAbsent(roomUid, userId, io);
  });

  socket.on("disconnect", async () => {
    for (const roomUid of socket.data.joinedRooms) {
      await onUserMaybeAbsent(roomUid, userId, io);
    }
  });
});

// Presence tracking (in-memory).
// roomUid -> Map<userId, socketCount>
// Multiple tabs by the same user bump the count; only count==0 means offline.
// Server restart loses state; rebuilt as clients reconnect.
const presenceByRoom = new Map();

function getPresenceMap(roomUid) {
  if (!presenceByRoom.has(roomUid)) presenceByRoom.set(roomUid, new Map());
  return presenceByRoom.get(roomUid);
}

async function onUserPresent(roomUid, userId, io) {
  const map = getPresenceMap(roomUid);
  const prevCount = map.get(userId) ?? 0;
  map.set(userId, prevCount + 1);

  // Only do global work on first online (user wasn't online before).
  if (prevCount === 0) {
    const onlineUsers = [...map.keys()];
    // First online user in the room → start the session timer.
    if (onlineUsers.length === 1) {
      const StudyRoom = mongoose.model("StudyRoom");
      const room = await StudyRoom.findOne({ uid: roomUid });
      if (room && room.active && !room.sessionStartAt) {
        room.sessionStartAt = new Date();
        await room.save();
        io.to(`room:${roomUid}`).emit("session-start", {
          sessionStartAt: room.sessionStartAt,
        });
      }
    }
  }

  // Broadcast the presence list either way, so new tabs pick up state
  // (old tabs getting a duplicate is harmless).
  const onlineUsers = [...map.keys()];
  io.to(`room:${roomUid}`).emit("presence", { online: onlineUsers });

  // Also (re)emit session-start so a fresh tab learns the current sessionStartAt.
  const StudyRoom2 = mongoose.model("StudyRoom");
  const room2 = await StudyRoom2.findOne({ uid: roomUid }, "sessionStartAt");
  if (room2?.sessionStartAt) {
    io.to(`room:${roomUid}`).emit("session-start", {
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
    return; // Other tabs still open; not really offline.
  }

  const onlineUsers = [...map.keys()];
  io.to(`room:${roomUid}`).emit("presence", { online: onlineUsers });

  // Everyone is offline → clear the session.
  if (onlineUsers.length === 0) {
    const StudyRoom = mongoose.model("StudyRoom");
    const room = await StudyRoom.findOne({ uid: roomUid });
    if (room && room.sessionStartAt) {
      room.sessionStartAt = null;
      await room.save();
      io.to(`room:${roomUid}`).emit("session-end");
    }
  }
}

httpServer.listen(process.env.PORT ?? 3000, () =>
  console.log("server running"),
);
