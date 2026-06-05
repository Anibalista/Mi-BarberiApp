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

export default function ProductosPage() {
  const { productos } = useAppData();

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Productos</span>
        <h2>Productos</h2>
        <p>Vista inicial para productos, precios y stock.</p>
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>{productos.length} productos activos</strong>
            <small>Después agregamos alta, edición, costos y stock.</small>
          </div>

          <button type="button" className="btn btn-primary">
            <FiPlus />
            Nuevo producto
          </button>
        </div>

        <div className="simple-list">
          {productos.length === 0 ? (
            <p className="empty-state">No hay productos cargados.</p>
          ) : (
            productos.map((producto) => (
              <article key={producto.id} className="list-row">
                <div>
                  <strong>{producto.nombre}</strong>
                  <small>Stock: {producto.stock_actual}</small>
                </div>

                <div className="price-pair">
                  <span>Lista: {formatCurrency(producto.precio_lista)}</span>
                  <span>
                    Efectivo: {formatCurrency(producto.precio_efectivo)}
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