import { useState } from "react";
import { FiArrowRight, FiBarChart2, FiCalendar, FiDollarSign } from "react-icons/fi";
import ThemeToggle from "../components/theme/ThemeToggle";
import { useAuth } from "../context/AuthContext";

export default function LoginPage() {
  const { loginWithGoogle } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  async function handleLogin() {
    try {
      setIsSubmitting(true);
      setErrorMessage("");
      await loginWithGoogle();
    } catch {
      setErrorMessage("No se pudo iniciar sesión con Google. Revisá la configuración.");
      setIsSubmitting(false);
    }
  }

  return (
    <main className="login-page">
      <header className="login-header">
        <div className="brand">
          <div className="brand__logo">💈</div>
          <div>
            <p className="brand__eyebrow">SaaS para barberías</p>
            <h1 className="brand__title">Mi BarberiApp</h1>
          </div>
        </div>

        <ThemeToggle />
      </header>

      <section className="login-hero">
        <div className="login-hero__content">
          <span className="badge">Demo privada en desarrollo</span>

          <h2>Gestioná turnos, ventas, caja y finanzas desde un solo lugar.</h2>

          <p>
            Una app pensada para propietarios de barberías que necesitan velocidad
            en la atención y claridad en los números del negocio.
          </p>

          <div className="login-features">
            <article className="feature-card">
              <FiCalendar />
              <div>
                <strong>Turnos y atención rápida</strong>
                <span>Registrá clientes sin frenar el trabajo diario.</span>
              </div>
            </article>

            <article className="feature-card">
              <FiDollarSign />
              <div>
                <strong>Cobros y caja diaria</strong>
                <span>Controlá ingresos, egresos y cierres de caja.</span>
              </div>
            </article>

            <article className="feature-card">
              <FiBarChart2 />
              <div>
                <strong>Reportes financieros</strong>
                <span>Visualizá ventas, comisiones y crecimiento.</span>
              </div>
            </article>
          </div>
        </div>

        <aside className="login-card">
          <div className="login-card__top">
            <div className="login-card__icon">💈</div>
            <div>
              <h3>Ingresar al sistema</h3>
              <p>Acceso habilitado solo para usuarios autorizados.</p>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary btn-full"
            onClick={handleLogin}
            disabled={isSubmitting}
          >
            {isSubmitting ? "Conectando..." : "Continuar con Google"}
            <FiArrowRight />
          </button>

          {errorMessage && <p className="form-error">{errorMessage}</p>}

          <p className="login-card__note">
            Si tu cuenta no fue autorizada por el propietario, no podrás ingresar.
          </p>
        </aside>
      </section>
    </main>
  );
}