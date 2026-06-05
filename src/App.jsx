import { useAuth } from "./context/AuthContext";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";

function App() {
  const { isAuthLoading, isAuthenticated } = useAuth();

  if (isAuthLoading) {
    return (
      <main className="loading-screen">
        <div className="loading-card">
          <div className="loading-logo">💈</div>
          <p>Cargando Mi BarberiApp...</p>
        </div>
      </main>
    );
  }

  return isAuthenticated ? <DashboardPage /> : <LoginPage />;
}

export default App;