import "./config.mjs";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import "./db.mjs";
import authRouter from './routes/auth.mjs';
import profileRouter from './routes/profile.mjs';
import tasksRouter from './routes/tasks.mjs';
import roomsRouter from './routes/rooms.mjs';
import avatarsRouter from './routes/avatars.mjs';

mongoose.connect(process.env.DSN).then(() => console.log("mongodb connected"));

const app = express();

app.set('trust proxy', 1);
console.log('NODE_ENV:', process.env.NODE_ENV);

const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',')
  : [];

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));

app.use(express.urlencoded({ extended: false }));
app.use(express.json({ limit: '10mb' }));

app.use(
  session({
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
  }),
);

app.use('/api/auth', authRouter);
app.use('/api/profile', profileRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/rooms', roomsRouter);
app.use('/api/avatars', avatarsRouter);

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

app.listen(process.env.PORT ?? 3000, () => console.log("server running"));
