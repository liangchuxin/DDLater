import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import "./styles/feed.css";
import { AuthProvider, useAuth } from "./context/AuthContext";

import Layout from "./components/Layout";
import Register from "./components/Register";
import Login from "./components/Login";
import Dashboard from "./components/Dashboard";
import Navigation from "./components/Navigation";
import Live from "./components/Live";
import CreateRoom from "./components/CreateRoom";
import JoinCodePage from "./components/JoinRoom";
import JoinConfirm from "./components/JoinConfirm";
import MyTasks from "./components/MyTasks";
import Rooms from "./components/Rooms";
import Profile from "./components/Profile";
import ProfileSettings from "./components/ProfileSettings";
import Badges from "./components/Badges";
import { AddTask, EditTask } from "./components/ManageTask";
import AvatarStudio from "./components/AvatarStudio";

function ProtectedRoute({ children }) {
  const { currentUser } = useAuth();
  if (currentUser === undefined) return null;
  if (!currentUser) return <Navigate to="/login" />;
  return children;
}
function GuestRoute({ children }) {
  const { currentUser } = useAuth();
  if (currentUser === undefined) return null;
  if (currentUser) return <Navigate to="/" />;
  return children;
}

function App() {
  return (
    <div className="App">
      <>
        <AuthProvider>
          <BrowserRouter>
            <Routes>
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
              {/* Guest routes: redirected to dashboard once logged in */}
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
                path="/live/create"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <CreateRoom />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/join"
                element={
                  <ProtectedRoute>
                    <JoinCodePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/join/:roomId"
                element={
                  <ProtectedRoute>
                    <JoinConfirm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/live/:uid"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <Live />
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
              <Route
                path="/tasks/add"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AddTask />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/tasks/:id/edit"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <EditTask />
                    </Layout>
                  </ProtectedRoute>
                }
              />
              <Route
                path="/avatar"
                element={
                  <ProtectedRoute>
                    <Layout>
                      <AvatarStudio />
                    </Layout>
                  </ProtectedRoute>
                }
              />
            </Routes>
          </BrowserRouter>
        </AuthProvider>
      </>
    </div>
  );
}

export default App;
