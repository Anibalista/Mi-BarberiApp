import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import { AppDataProvider, useAppData } from "./context/AppDataContext";
import DashboardPage from "./pages/DashboardPage";
import LoginPage from "./pages/LoginPage";
import NuevaVentaPage from "./pages/NuevaVentaPage";
import NuevoTurnoPage from "./pages/NuevoTurnoPage";
import AtencionRapidaPage from "./pages/AtencionRapidaPage";
import ClientesPage from "./pages/ClientesPage";
import ServiciosPage from "./pages/ServiciosPage";
import ProductosPage from "./pages/ProductosPage";
import PlaceholderPage from "./pages/PlaceholderPage";

function LoadingScreen({ text = "Cargando Mi BarberiApp..." }) {
  return (
    <main className="loading-screen">
      <div className="loading-card">
        <div className="loading-logo">💈</div>
        <p>{text}</p>
      </div>
    </main>
  );
}

function ProtectedRoutes() {
  const { isAppDataLoading, appDataError } = useAppData();

  if (isAppDataLoading) {
    return <LoadingScreen text="Cargando datos del negocio..." />;
  }

  if (appDataError) {
    return (
      <main className="loading-screen">
        <div className="loading-card">
          <div className="loading-logo">⚠️</div>
          <p>{appDataError}</p>
        </div>
      </main>
    );
  }

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/ventas/nueva" element={<NuevaVentaPage />} />
        <Route path="/turnos/nuevo" element={<NuevoTurnoPage />} />
        <Route path="/atenciones/nueva" element={<AtencionRapidaPage />} />
        <Route path="/clientes" element={<ClientesPage />} />
        <Route path="/servicios" element={<ServiciosPage />} />
        <Route path="/productos" element={<ProductosPage />} />

        <Route
          path="/caja"
          element={
            <PlaceholderPage
              title="Caja diaria"
              description="Acá vamos a crear apertura, movimientos y cierre de caja."
            />
          }
        />

        <Route
          path="/finanzas"
          element={
            <PlaceholderPage
              title="Finanzas"
              description="Acá van los ingresos, egresos, retiros y comparativas."
            />
          }
        />

        <Route
          path="/comisiones"
          element={
            <PlaceholderPage
              title="Comisiones"
              description="Acá vamos a gestionar reglas, liquidaciones y pagos a barberos."
            />
          }
        />

        <Route
          path="/reportes"
          element={
            <PlaceholderPage
              title="Reportes"
              description="Acá irán gráficos de ventas, caja, clientes y crecimiento."
            />
          }
        />

        <Route
          path="/configuracion"
          element={
            <PlaceholderPage
              title="Configuración"
              description="Acá se administrarán negocio, roles, permisos y sucursales."
            />
          }
        />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

function App() {
  const { isAuthLoading, isAuthenticated } = useAuth();

  if (isAuthLoading) {
    return <LoadingScreen />;
  }

  if (!isAuthenticated) {
    return <LoginPage />;
  }

  return (
    <AppDataProvider>
      <ProtectedRoutes />
    </AppDataProvider>
  );
}

export default App;