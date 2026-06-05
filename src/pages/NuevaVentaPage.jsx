import { useMemo, useState } from "react";
import { FiPlus, FiSave, FiTrash2 } from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function NuevaVentaPage() {
  const { servicios, productos, mediosPago } = useAppData();

  const [clienteNombre, setClienteNombre] = useState("");
  const [medioPagoId, setMedioPagoId] = useState("");
  const [tipoPrecio, setTipoPrecio] = useState("efectivo");
  const [items, setItems] = useState([]);

  const total = useMemo(
    () => items.reduce((acc, item) => acc + Number(item.subtotal || 0), 0),
    [items]
  );

  function addItem(tipo, id) {
    if (!id) return;

    const source =
      tipo === "servicio"
        ? servicios.find((item) => item.id === id)
        : productos.find((item) => item.id === id);

    if (!source) return;

    const precio =
      tipoPrecio === "efectivo"
        ? source.precio_efectivo
        : source.precio_lista;

    setItems((current) => [
      ...current,
      {
        tempId: crypto.randomUUID(),
        tipo,
        id: source.id,
        nombre: source.nombre,
        cantidad: 1,
        precio,
        subtotal: Number(precio || 0),
      },
    ]);
  }

  function removeItem(tempId) {
    setItems((current) => current.filter((item) => item.tempId !== tempId));
  }

  function handleSubmit(event) {
    event.preventDefault();

    alert(
      "Todavía no guardamos la venta. Esta pantalla ya calcula y prepara el flujo; el próximo paso es insertar atención + detalle + pago."
    );
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Venta rápida</span>
        <h2>Nueva venta</h2>
        <p>
          Cargá servicios o productos, elegí precio efectivo/lista y prepará el
          cobro.
        </p>
      </section>

      <form className="work-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Cliente</span>
            <input
              type="text"
              value={clienteNombre}
              onChange={(event) => setClienteNombre(event.target.value)}
              placeholder="Ej: Juan"
            />
          </label>

          <label className="form-field">
            <span>Medio de pago</span>
            <select
              value={medioPagoId}
              onChange={(event) => setMedioPagoId(event.target.value)}
            >
              <option value="">Seleccionar</option>
              {mediosPago.map((medio) => (
                <option key={medio.id} value={medio.id}>
                  {medio.nombre}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Tipo de precio</span>
            <select
              value={tipoPrecio}
              onChange={(event) => setTipoPrecio(event.target.value)}
            >
              <option value="efectivo">Precio efectivo</option>
              <option value="lista">Precio de lista</option>
            </select>
          </label>
        </div>

        <div className="sale-picker-grid">
          <label className="form-field">
            <span>Agregar servicio</span>
            <select
              defaultValue=""
              onChange={(event) => {
                addItem("servicio", event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">Seleccionar servicio</option>
              {servicios.map((servicio) => (
                <option key={servicio.id} value={servicio.id}>
                  {servicio.nombre} ·{" "}
                  {formatCurrency(
                    tipoPrecio === "efectivo"
                      ? servicio.precio_efectivo
                      : servicio.precio_lista
                  )}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Agregar producto</span>
            <select
              defaultValue=""
              onChange={(event) => {
                addItem("producto", event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">Seleccionar producto</option>
              {productos.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre} ·{" "}
                  {formatCurrency(
                    tipoPrecio === "efectivo"
                      ? producto.precio_efectivo
                      : producto.precio_lista
                  )}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="items-list">
          {items.length === 0 ? (
            <p className="empty-state">Todavía no agregaste ítems.</p>
          ) : (
            items.map((item) => (
              <article key={item.tempId} className="line-item">
                <div>
                  <strong>{item.nombre}</strong>
                  <small>{item.tipo}</small>
                </div>

                <span>{formatCurrency(item.subtotal)}</span>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeItem(item.tempId)}
                  aria-label="Quitar item"
                >
                  <FiTrash2 />
                </button>
              </article>
            ))
          )}
        </div>

        <div className="total-bar">
          <span>Total</span>
          <strong>{formatCurrency(total)}</strong>
        </div>

        <div className="form-actions">
          <button type="button" className="btn btn-ghost">
            <FiPlus />
            Dejar pendiente
          </button>

          <button type="submit" className="btn btn-primary">
            <FiSave />
            Registrar venta
          </button>
        </div>
      </form>
    </PageShell>
  );
}