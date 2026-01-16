import {
  BrowserRouter as Router,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { TeamProvider } from "./contexts/TeamContext";
import LoginPage from "./pages/auth/LoginPage";
import RegisterPage from "./pages/auth/RegisterPage";
import Dashboard from "./pages/Dashboard";
import PlayerDashboard from "./pages/PlayerDashboard";
import { CreateTeamPage } from "./pages/teams/CreateTeamPage";
import { GamesPage } from "./pages/teams/GamesPage";
import { CreateGamePage } from "./pages/teams/CreateGamePage";
import { EditGamePage } from "./pages/teams/EditGamePage";
import { ScoreGamePage } from "./pages/teams/ScoreGamePage";
import { RosterPage } from "./pages/teams/RosterPage";
import LineupPage from "./pages/teams/LineupPage";
import { AcceptInvitePage } from "./pages/AcceptInvitePage";
import { AdminTeamsPage } from "./pages/admin/AdminTeamsPage";
import Layout from "./components/Layout";

const ProtectedRoute = ({ children }: { children: React.ReactNode }) => {
  const { isAuthenticated, isLoading } = useAuth();

  if (isLoading) {
    return <div>Loading...</div>;
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

function App() {
  return (
    <Router>
      <AuthProvider>
        <TeamProvider>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route element={<Layout />}>
              <Route
                path="/"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/create"
                element={
                  <ProtectedRoute>
                    <CreateTeamPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/games"
                element={
                  <ProtectedRoute>
                    <GamesPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/roster"
                element={
                  <ProtectedRoute>
                    <RosterPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/lineup"
                element={
                  <ProtectedRoute>
                    <LineupPage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/profile"
                element={
                  <ProtectedRoute>
                    <PlayerDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/games/new"
                element={
                  <ProtectedRoute>
                    <CreateGamePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/games/:gameId/edit"
                element={
                  <ProtectedRoute>
                    <EditGamePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/teams/:teamId/games/:gameId/score"
                element={
                  <ProtectedRoute>
                    <ScoreGamePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/invitations/:token"
                element={
                  <ProtectedRoute>
                    <AcceptInvitePage />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/teams"
                element={
                  <ProtectedRoute>
                    <AdminTeamsPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </TeamProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
