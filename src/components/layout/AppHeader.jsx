import { FiArrowLeft, FiLogOut } from "react-icons/fi";
import { Link, useLocation, useNavigate } from "react-router-dom";
import ThemeToggle from "../theme/ThemeToggle";
import { useAuth } from "../../context/AuthContext";
import { useAppData } from "../../context/AppDataContext";

export default function AppHeader() {
  const { logout } = useAuth();
  const { sucursal } = useAppData();
  const navigate = useNavigate();
  const location = useLocation();

  const isHome = location.pathname === "/";

  async function handleLogout() {
    await logout();
  }

  return (
    <header className="app-header">
      <div className="brand">
        {!isHome && (
          <button
            type="button"
            className="icon-button"
            onClick={() => navigate(-1)}
            aria-label="Volver"
          >
            <FiArrowLeft />
          </button>
        )}

        <Link to="/" className="brand brand--link">
          <div className="brand__logo">💈</div>
          <div>
            <p className="brand__eyebrow">
              {sucursal?.nombre || "Sucursal principal"}
            </p>
            <h1 className="brand__title">Mi BarberiApp</h1>
          </div>
        </Link>
      </div>

      <div className="header-actions">
        <ThemeToggle />

        <button type="button" className="btn btn-ghost" onClick={handleLogout}>
          <FiLogOut />
          Salir
        </button>
      </div>
    </header>
  );
}