import { useState } from "react";
import { FiCalendar, FiSave } from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";

export default function NuevoTurnoPage() {
  const { servicios } = useAppData();

  const [form, setForm] = useState({
    cliente: "",
    telefono: "",
    fecha: "",
    hora: "",
    servicioId: "",
    notas: "",
  });

  function updateField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  function handleSubmit(event) {
    event.preventDefault();

    alert(
      "Todavía no guardamos el turno. El próximo paso será buscar/crear cliente e insertar en la tabla turnos."
    );
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Agenda</span>
        <h2>Nuevo turno</h2>
        <p>
          Pantalla simple para cargar una reserva con cliente, fecha, hora y
          servicio estimado.
        </p>
      </section>

      <form className="work-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <label className="form-field">
            <span>Nombre del cliente</span>
            <input
              type="text"
              value={form.cliente}
              onChange={(event) => updateField("cliente", event.target.value)}
              placeholder="Ej: Juan Pérez"
              required
            />
          </label>

          <label className="form-field">
            <span>Teléfono / WhatsApp</span>
            <input
              type="text"
              value={form.telefono}
              onChange={(event) => updateField("telefono", event.target.value)}
              placeholder="Opcional pero recomendado"
            />
          </label>

          <label className="form-field">
            <span>Fecha</span>
            <input
              type="date"
              value={form.fecha}
              onChange={(event) => updateField("fecha", event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>Hora</span>
            <input
              type="time"
              value={form.hora}
              onChange={(event) => updateField("hora", event.target.value)}
              required
            />
          </label>

          <label className="form-field">
            <span>Servicio estimado</span>
            <select
              value={form.servicioId}
              onChange={(event) => updateField("servicioId", event.target.value)}
            >
              <option value="">Seleccionar</option>
              {servicios.map((servicio) => (
                <option key={servicio.id} value={servicio.id}>
                  {servicio.nombre}
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="form-field">
          <span>Notas</span>
          <textarea
            value={form.notas}
            onChange={(event) => updateField("notas", event.target.value)}
            placeholder="Ej: viene por corte + barba"
            rows="4"
          />
        </label>

        <div className="form-actions">
          <button type="submit" className="btn btn-primary">
            <FiSave />
            Guardar turno
          </button>

          <button type="button" className="btn btn-ghost">
            <FiCalendar />
            Ver agenda
          </button>
        </div>
      </form>
    </PageShell>
  );
}