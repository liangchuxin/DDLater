import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Register from "./components/Register";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Navigation from "./components/Navigation";
import MyTasks from "./components/MyTasks";
import Rooms from "./components/Rooms";
import Profile from "./components/Profile";

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  if (currentUser === undefined) return null; // loading
  if (!currentUser) return <Navigate to="/login" />;
  return children;
}
function GuestRoute({ children }) {
  const { currentUser } = useAuth();
  if (currentUser === undefined) return null; // 加载中
  if (currentUser) return <Navigate to="/" />; // 已登录就跳回 dashboard
  return children;
}

function App() {
  return (
    <div className="App">
      <>
        <AuthProvider>
          <BrowserRouter>
            {/* <NavBar /> */}
            <Routes>
              {/* <Route path="/games/:id/play/:topic" element={<PlayGame />} /> */}

              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Navigation />
                    <Dashboard />
                  </ProtectedRoute>
                }
              />

              {/* 未登录 / 跳转至产品界面 landing page */}

              <Route
                path="/login"
                element={
                  <GuestRoute>
                    <Login />
                  </GuestRoute>
                }
              />
              <Route
                path="/register"
                element={
                  <GuestRoute>
                    <Register />
                  </GuestRoute>
                }
              />
              <Route
                path="/tasks"
                element={
                  <ProtectedRoute>
                    <Navigation />
                    <MyTasks />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rooms"
                element={
                  <ProtectedRoute>
                    <Navigation />
                    <Rooms />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/profile"
                element={
                  <ProtectedRoute>
                    <Navigation />
                    <Profile />
                  </ProtectedRoute>
                }
              />
              {/* users */}
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </>
    </div>
  );
}

export default App;
