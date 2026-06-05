import { useState } from "react";
import {
  FiArchive,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiClipboard,
  FiDollarSign,
  FiLogOut,
  FiPackage,
  FiPieChart,
  FiPlusCircle,
  FiScissors,
  FiSettings,
  FiShoppingCart,
  FiUsers,
} from "react-icons/fi";
import ThemeToggle from "../components/theme/ThemeToggle";
import { useAuth } from "../context/AuthContext";

const quickActions = [
  {
    title: "Nueva venta",
    description: "Cobrar servicio o producto al instante.",
    icon: FiShoppingCart,
    variant: "primary",
  },
  {
    title: "Nuevo turno",
    description: "Agendar cliente con fecha y barbero.",
    icon: FiCalendar,
    variant: "default",
  },
  {
    title: "Registrar atención",
    description: "Carga rápida sin pasar por cola.",
    icon: FiScissors,
    variant: "default",
  },
];

const advancedOptions = [
  {
    title: "Clientes",
    description: "Alta, búsqueda e historial.",
    icon: FiUsers,
  },
  {
    title: "Servicios",
    description: "Precios de lista y efectivo.",
    icon: FiScissors,
  },
  {
    title: "Productos",
    description: "Ventas, stock y costos.",
    icon: FiPackage,
  },
  {
    title: "Caja diaria",
    description: "Apertura, movimientos y cierre.",
    icon: FiArchive,
  },
  {
    title: "Finanzas",
    description: "Ingresos, egresos y retiros.",
    icon: FiDollarSign,
  },
  {
    title: "Comisiones",
    description: "Reglas y liquidaciones.",
    icon: FiBriefcase,
  },
  {
    title: "Reportes",
    description: "Gráficos y métricas del negocio.",
    icon: FiBarChart2,
  },
  {
    title: "Configuración",
    description: "Roles, permisos y negocio.",
    icon: FiSettings,
  },
];

export default function DashboardPage() {
  const { user, logout } = useAuth();
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Usuario";

  async function handleLogout() {
    try {
      setIsLoggingOut(true);
      await logout();
    } catch {
      setIsLoggingOut(false);
    }
  }

  function handleComingSoon(optionName) {
    alert(`${optionName} estará disponible en la próxima etapa.`);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="brand">
          <div className="brand__logo">💈</div>
          <div>
            <p className="brand__eyebrow">Panel principal</p>
            <h1 className="brand__title">Mi BarberiApp</h1>
          </div>
        </div>

        <div className="header-actions">
          <ThemeToggle />

          <button
            type="button"
            className="btn btn-ghost"
            onClick={handleLogout}
            disabled={isLoggingOut}
          >
            <FiLogOut />
            {isLoggingOut ? "Saliendo..." : "Salir"}
          </button>
        </div>
      </header>

      <section className="dashboard-hero">
        <div>
          <span className="badge">Sucursal principal</span>
          <h2>Hola, {userName}</h2>
          <p>
            Tenés a mano las acciones principales para trabajar rápido. Las
            opciones administrativas quedan agrupadas para no llenar la pantalla.
          </p>
        </div>

        <article className="today-card">
          <span>Resumen de hoy</span>
          <strong>$0</strong>
          <small>Ventas registradas: 0</small>
        </article>
      </section>

      <section className="section-block">
        <div className="section-heading">
          <div>
            <p className="section-kicker">Acciones rápidas</p>
            <h3>Lo que más se usa durante el día</h3>
          </div>
        </div>

        <div className="quick-grid">
          {quickActions.map((action) => {
            const Icon = action.icon;

            return (
              <button
                key={action.title}
                type="button"
                className={`quick-action ${
                  action.variant === "primary" ? "quick-action--primary" : ""
                }`}
                onClick={() => handleComingSoon(action.title)}
              >
                <span className="quick-action__icon">
                  <Icon />
                </span>

                <span className="quick-action__body">
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>

                <FiPlusCircle className="quick-action__plus" />
              </button>
            );
          })}
        </div>
      </section>

      <section className="section-block">
        <button
          type="button"
          className="advanced-toggle"
          onClick={() => setShowAdvanced((current) => !current)}
          aria-expanded={showAdvanced}
        >
          <span>
            <FiClipboard />
            Opciones avanzadas
          </span>

          {showAdvanced ? <FiChevronUp /> : <FiChevronDown />}
        </button>

        {showAdvanced && (
          <div className="advanced-grid">
            {advancedOptions.map((option) => {
              const Icon = option.icon;

              return (
                <button
                  key={option.title}
                  type="button"
                  className="module-card"
                  onClick={() => handleComingSoon(option.title)}
                >
                  <span className="module-card__icon">
                    <Icon />
                  </span>

                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </section>

      <section className="stats-grid">
        <article className="stat-card">
          <FiDollarSign />
          <span>Ingresos de hoy</span>
          <strong>$0</strong>
        </article>

        <article className="stat-card">
          <FiPieChart />
          <span>Caja actual</span>
          <strong>Sin abrir</strong>
        </article>

        <article className="stat-card">
          <FiUsers />
          <span>Clientes atendidos</span>
          <strong>0</strong>
        </article>
      </section>
    </main>
  );
}