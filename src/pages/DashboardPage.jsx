import {
  FiArchive,
  FiBarChart2,
  FiBriefcase,
  FiCalendar,
  FiChevronDown,
  FiChevronUp,
  FiClipboard,
  FiDollarSign,
  FiPackage,
  FiPieChart,
  FiPlusCircle,
  FiScissors,
  FiSettings,
  FiShoppingCart,
  FiUserCheck,
  FiUsers,
} from "react-icons/fi";
import { Link } from "react-router-dom";
import { useState } from "react";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { useAuth } from "../context/AuthContext";

const quickActions = [
  {
    title: "Registrar atención",
    description: "Carga rápida sin pasar por cola.",
    icon: FiScissors,
    to: "/atenciones/nueva",
    variant: "primary",
  },
  {
    title: "Nuevo turno",
    description: "Agendar cliente con fecha y barbero.",
    icon: FiCalendar,
    to: "/turnos/nuevo",
    variant: "default",
  },
  {
    title: "Nueva venta",
    description: "Cobrar producto al instante.",
    icon: FiShoppingCart,
    to: "/ventas/nueva",
    variant: "default",
  },
];

const advancedOptions = [
  {
    title: "Clientes",
    description: "Alta, búsqueda e historial.",
    icon: FiUsers,
    to: "/clientes",
  },
  {
    title: "Barberos y puestos",
    description: "Equipo, categorías y comisiones.",
    icon: FiUserCheck,
    to: "/barberos",
  },
  {
    title: "Servicios",
    description: "Precios de lista y efectivo.",
    icon: FiScissors,
    to: "/servicios",
  },
  {
    title: "Productos",
    description: "Ventas, stock y costos.",
    icon: FiPackage,
    to: "/productos",
  },
  {
    title: "Caja diaria",
    description: "Movimientos, egresos y cierre.",
    icon: FiArchive,
    to: "/caja",
  },
  {
    title: "Finanzas",
    description: "Ingresos, egresos y retiros.",
    icon: FiDollarSign,
    to: "/finanzas",
  },
  {
    title: "Comisiones",
    description: "Reglas y liquidaciones.",
    icon: FiBriefcase,
    to: "/comisiones",
  },
  {
    title: "Reportes",
    description: "Gráficos y métricas del negocio.",
    icon: FiBarChart2,
    to: "/reportes",
  },
  {
    title: "Configuración",
    description: "Roles, permisos y negocio.",
    icon: FiSettings,
    to: "/configuracion",
  },
];

export default function DashboardPage() {
  const { user } = useAuth();
  const {
    negocio,
    sucursal,
    clientes,
    servicios,
    productos,
    colaboradores,
  } = useAppData();
  const [showAdvanced, setShowAdvanced] = useState(false);

  const userName =
    user?.user_metadata?.full_name ||
    user?.user_metadata?.name ||
    user?.email ||
    "Usuario";

  return (
    <PageShell>
      <section className="dashboard-hero">
        <div>
          <span className="badge">
            {sucursal?.nombre || "Sucursal principal"}
          </span>
          <h2>Hola, {userName}</h2>
          <p>
            {negocio?.nombre || "Tu barbería"} ya tiene el panel base listo.
            Usá las acciones rápidas para registrar atenciones, turnos o ventas
            sin perder tiempo.
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
              <Link
                key={action.title}
                to={action.to}
                className={`quick-action ${
                  action.variant === "primary" ? "quick-action--primary" : ""
                }`}
              >
                <span className="quick-action__icon">
                  <Icon />
                </span>

                <span className="quick-action__body">
                  <strong>{action.title}</strong>
                  <small>{action.description}</small>
                </span>

                <FiPlusCircle className="quick-action__plus" />
              </Link>
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
                <Link key={option.title} to={option.to} className="module-card">
                  <span className="module-card__icon">
                    <Icon />
                  </span>

                  <span>
                    <strong>{option.title}</strong>
                    <small>{option.description}</small>
                  </span>
                </Link>
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

        <Link to="/caja" className="stat-card stat-card--link">
          <FiPieChart />
          <span>Caja actual</span>
          <strong>Ver caja</strong>
          <small>Movimientos y cierre diario</small>
        </Link>

        <article className="stat-card">
          <FiUsers />
          <span>Base cargada</span>
          <strong>
            {clientes.length} clientes · {servicios.length} servicios ·{" "}
            {productos.length} productos · {colaboradores.length} colaboradores
          </strong>
        </article>
      </section>
    </PageShell>
  );
}