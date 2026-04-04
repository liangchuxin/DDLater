import "./config.mjs";
import cors from "cors";
import express from "express";
import mongoose from "mongoose";
import session from "express-session";
import MongoStore from "connect-mongo";
import "./db.mjs";
import authRouter from "./routes/auth.mjs";

// 数据库连接

mongoose.connect(process.env.DSN).then(() => console.log("mongodb connected"));

const app = express();

app.use(cors({ origin: process.env.CLIENT_URL, credentials: true }));

// middleware

app.use(express.urlencoded({ extended: false }));
app.use(express.json());

app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    store: MongoStore.create({ mongoUrl: process.env.DSN }),
  }),
);

app.use("/api/auth", authRouter);

app.get("/api/test", (req, res) => res.json({ message: "ok" }));

app.listen(process.env.PORT ?? 3000, () => console.log("server running"));
