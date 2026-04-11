import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./feed.css";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Layout from "./components/Layout";
import Register from "./components/Register";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Navigation from "./components/Navigation";
import MyTasks from "./components/MyTasks";
import Rooms from "./components/Rooms";
import Profile from "./components/Profile";
import ProfileSettings from "./components/ProfileSettings";
import Badges from "./components/Badges";

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  if (currentUser === undefined) return null;
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
                    <Layout>
                      <Dashboard />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/badges"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Badges />
                    </Layout>
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
                    <Layout>
                      <MyTasks />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/rooms"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Rooms />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user/:uid"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Profile />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Profile />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user/settings"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <ProfileSettings />
                    </Layout>
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
