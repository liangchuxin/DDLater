Milestone 03
===

Repository Link
---
https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin

URL for form 1 (from previous milestone)
---
https://final-project-liangchuxin-1.onrender.com/register

Special Instructions for Form 1
---
Visit the register page and fill in email, display name, and password to create an account.

URL for form 2 (for current milestone)
---
https://final-project-liangchuxin-1.onrender.com/tasks/add

Special Instructions for Form 2
---
You must be logged in to access this form. Register an account first, then log in, then navigate to My Tasks and click Add Task. Fill in title, due date, course, and progress to create a task.

URL(s) to github repository with commits that show progress on research
---
https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/tree/main/client
(React frontend with Vite, React Router, Auth Context, protected routes, and full task CRUD implemented)

https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/routes/auth.mjs
(Passport-style session-based authentication with bcryptjs)

References
---
1. React Context API for authentication with protected routes — concept referenced when designing `AuthContext.jsx` and `ProtectedRoute`:
   https://dev.to/finiam/predictable-react-authentication-with-the-context-api-g10
   Relevant code: https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/context/AuthContext.jsx

2. React authentication with Context and hooks (Auth0 guide) — referenced for the `useAuth()` hook pattern and session-based protected route logic:
   https://auth0.com/blog/complete-guide-to-react-user-authentication/
   Relevant code: https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/App.jsx

3. Perler Beads pixel art image processing (Zippland/perler-beads) — referenced for the image-to-color-grid algorithm and flood-fill background removal logic used in `pixelChar.js`:
   https://github.com/Zippland/perler-beads
   Relevant code: https://github.com/nyu-csci-ua-0467-001-002-spring-26/final-project-liangchuxin/blob/main/client/src/utils/pixelChar.js
