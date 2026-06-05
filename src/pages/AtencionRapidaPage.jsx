import { useMemo, useState } from "react";
import { FiSave, FiScissors, FiTrash2 } from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";

function formatCurrency(value) {
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    maximumFractionDigits: 0,
  }).format(Number(value || 0));
}

export default function AtencionRapidaPage() {
  const { servicios, mediosPago } = useAppData();

  const [clienteNombre, setClienteNombre] = useState("");
  const [tipoPrecio, setTipoPrecio] = useState("efectivo");
  const [medioPagoId, setMedioPagoId] = useState("");
  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);

  const total = useMemo(
    () =>
      serviciosSeleccionados.reduce(
        (acc, item) => acc + Number(item.precio || 0),
        0
      ),
    [serviciosSeleccionados]
  );

  function addServicio(servicioId) {
    if (!servicioId) return;

    const servicio = servicios.find((item) => item.id === servicioId);
    if (!servicio) return;

    const precio =
      tipoPrecio === "efectivo"
        ? servicio.precio_efectivo
        : servicio.precio_lista;

    setServiciosSeleccionados((current) => [
      ...current,
      {
        tempId: crypto.randomUUID(),
        id: servicio.id,
        nombre: servicio.nombre,
        precio,
      },
    ]);
  }

  function removeServicio(tempId) {
    setServiciosSeleccionados((current) =>
      current.filter((item) => item.tempId !== tempId)
    );
  }

  function handleSubmit(event) {
    event.preventDefault();

    alert(
      "Todavía no insertamos la atención. Esta pantalla será el flujo rápido: atención + servicio + pago."
    );
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Sin cola obligatoria</span>
        <h2>Registrar atención rápida</h2>
        <p>
          Pensada para cuando el barbero necesita cargar cliente, servicio y
          cobro sin pasos extra.
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
              placeholder="Ej: Cliente de paso"
              required
            />
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
        </div>

        <label className="form-field">
          <span>Agregar servicio</span>
          <select
            defaultValue=""
            onChange={(event) => {
              addServicio(event.target.value);
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

        <div className="items-list">
          {serviciosSeleccionados.length === 0 ? (
            <p className="empty-state">Todavía no agregaste servicios.</p>
          ) : (
            serviciosSeleccionados.map((servicio) => (
              <article key={servicio.tempId} className="line-item">
                <div>
                  <strong>{servicio.nombre}</strong>
                  <small>Servicio</small>
                </div>

                <span>{formatCurrency(servicio.precio)}</span>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeServicio(servicio.tempId)}
                  aria-label="Quitar servicio"
                >
                  <FiTrash2 />
                </button>
              </article>
            ))
          )}
        </div>

        <div className="total-bar">
          <span>Total atención</span>
          <strong>{formatCurrency(total)}</strong>
        </div>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            <FiSave />
            Guardar atención
          </button>

          <button type="button" className="btn btn-ghost">
            <FiScissors />
            Guardar sin cobrar
          </button>
        </div>
      </form>
    </PageShell>
  );
}