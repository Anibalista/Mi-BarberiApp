import { FiPlus } from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function ServiciosPage() {
  const { servicios } = useAppData();

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Servicios</span>
        <h2>Servicios</h2>
        <p>Lista inicial de servicios con precio de lista y precio efectivo.</p>
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>{servicios.length} servicios activos</strong>
            <small>Después agregamos edición y activación/inactivación.</small>
          </div>

          <button type="button" className="btn btn-primary">
            <FiPlus />
            Nuevo servicio
          </button>
        </div>

        <div className="simple-list">
          {servicios.length === 0 ? (
            <p className="empty-state">No hay servicios cargados.</p>
          ) : (
            servicios.map((servicio) => (
              <article key={servicio.id} className="list-row">
                <div>
                  <strong>{servicio.nombre}</strong>
                  <small>{servicio.descripcion || "Sin descripción"}</small>
                </div>

                <div className="price-pair">
                  <span>Lista: {formatCurrency(servicio.precio_lista)}</span>
                  <span>
                    Efectivo: {formatCurrency(servicio.precio_efectivo)}
                  </span>
                </div>
              </article>
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}