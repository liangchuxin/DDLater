Milestone 04 - Final Project Documentation
===

NetID
---
cl7093

Name
---
Chuxin Liang

Repository Link
---
https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin

URL for deployed site
---
https://final-project-liangchuxin-1.onrender.com

URL for form 1 (from previous milestone)
---
https://final-project-liangchuxin-1.onrender.com/register

Special Instructions for Form 1
---
Fill in email, display name, and password to create an account. Note: the Render free tier may take 20-40 seconds to wake up on the first request after idle.

URL for form 2 (from previous milestone)
---
https://final-project-liangchuxin-1.onrender.com/tasks/add

Special Instructions for Form 2
---
Must be logged in. Register first, then navigate to My Tasks and click "Add Task". Fill in title, due date, course, and progress.

URL for form 3 (for current milestone)
---
https://final-project-liangchuxin-1.onrender.com/rooms/create

Special Instructions for Form 3
---
Must be logged in. Navigate to Study Rooms and click "Create Room". Fill in a room name and submit to create a realtime study room that you own; other users can request to join your room.

First link to github line number(s) for constructor, HOF, etc.
---
https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/components/Dashboard.jsx#L230-L244

Second link to github line number(s) for constructor, HOF, etc.
---
[https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/components/MyTasks.jsx#L174](https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/components/MyTasks.jsx#L174)

Short description for links above
---
Dashboard.jsx - the `filtered` useMemo uses Array.prototype.filter to narrow the feed by "Due Today" / "0% Done" / "My School" / "My Course" criteria (search for `const filtered = useMemo`). Also uses Array.prototype.map inside the JSX to render feed cards.

MyTasks.jsx L174 - uses Array.prototype.map to transform the tasks array into rendered TaskCard components. 

Link to github line number(s) for schemas (db.js or models folder)
---
https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/db.mjs

Description of research topics above with points
---
5 points - Session-based authentication with express-session + bcryptjs + connect-mongo MongoDB session store; session cookie is shared between HTTP routes and socket.io via io.engine.use(sessionMiddleware), so socket handlers can read socket.request.session.userId

5 points - Realtime multi-user study rooms with socket.io: per-user presence tracking with socket-count map for multi-tab support, session-start / session-end broadcast, room-event channel for join/leave/approve/reject/kick/task updates, personal user:<id> channels for targeted notifications

3 points - React 19 + React Router 7 as frontend framework, with Context API for auth (AuthContext), custom useSocket hook using the latest-ref pattern to keep socket listeners stable while handlers stay fresh, protected routes, Vite dev server proxied to Express backend

2 points - Vite as build tool with environment-variable-driven API URL (VITE_API_URL) and separate client / server deploys on Render

2 points - ESLint integrated into the client workflow with flat config (eslint.config.js), react-hooks and react-refresh plugins

3 points - Custom pixel-art avatar pipeline in pixelChar.js: Canvas-based image-to-color-grid sampling, flood-fill background removal, and discrete step-based idle animation. Algorithm referenced from the Zippland/perler-beads open-source project.

1 point - Universities (hipolabs) external API integration for the school-picker autocomplete on the profile setup form

Links to github line number(s) for research topics described above (one link per line)
---
https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/routes/auth.mjs

https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/app.mjs

https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/context/AuthContext.jsx

https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/hooks/useSocket.js

https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/vite.config.js

https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/eslint.config.js

https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/utils/pixelChar.js

https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/app.mjs

Attributions
---
Key references:

client/src/context/AuthContext.jsx - React Context auth pattern - https://dev.to/finiam/predictable-react-authentication-with-the-context-api-g10

client/src/utils/pixelChar.js - image-to-color-grid and flood-fill background removal algorithm - https://github.com/Zippland/perler-beads

client/src/components/PushOutLoader.jsx - push-out CSS loader animation - https://codepen.io/jh3y/pen/ZEEEGWr

app.mjs - socket.io + express-session sharing pattern - https://socket.io/how-to/use-with-express-session
