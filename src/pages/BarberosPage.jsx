import { useMemo, useState } from "react";
import {
  FiBriefcase,
  FiEdit2,
  FiPlus,
  FiSave,
  FiSearch,
  FiToggleLeft,
  FiToggleRight,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../lib/supabaseClient";
import {
  capitalizeFirstLetter,
  normalizeText,
  preventInvalidNumberKeys,
} from "../utils/formGuards";

const FRECUENCIAS = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
  { value: "manual", label: "Manual" },
];

const emptyBarberoForm = {
  id: null,
  nombre_publico: "",
  categoria_id: "",
  es_barbero: true,
  es_propietario: false,
  usa_comision_personalizada: false,
  porcentaje_comision_default: "",
  frecuencia_pago_default: "",
  activo: true,
};

const emptyCategoriaForm = {
  id: null,
  nombre: "",
  descripcion: "",
  usa_comision_default: false,
  porcentaje_comision_default: "",
  frecuencia_pago_default: "manual",
  activa: true,
};

function normalizePercentageInput(value) {
  const clean = String(value || "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parts = clean.split(".");
  const normalized =
    parts.length > 2 ? `${parts[0]}.${parts.slice(1).join("")}` : clean;

  if (normalized === "") return "";

  const numberValue = Number(normalized);

  if (!Number.isFinite(numberValue)) return "";
  if (numberValue > 100) return "100";

  return normalized;
}

function percentageLabel(value) {
  if (value === null || value === undefined || value === "") {
    return "Sin configurar";
  }

  return `${Number(value)}%`;
}

function frequencyLabel(value) {
  return (
    FRECUENCIAS.find((item) => item.value === value)?.label ||
    "Heredada del puesto"
  );
}

function getEffectiveCommission(colaborador, categoria) {
  if (
    colaborador?.porcentaje_comision_default !== null &&
    colaborador?.porcentaje_comision_default !== undefined
  ) {
    return {
      value: Number(colaborador.porcentaje_comision_default),
      source: "Personalizada",
    };
  }

  if (
    categoria?.porcentaje_comision_default !== null &&
    categoria?.porcentaje_comision_default !== undefined
  ) {
    return {
      value: Number(categoria.porcentaje_comision_default),
      source: `Puesto: ${categoria.nombre}`,
    };
  }

  return {
    value: null,
    source: "Se resolverá por servicio",
  };
}

function validatePercentage(value, enabled, fieldName) {
  if (!enabled) return "";

  if (value === "") {
    return `Ingresá el porcentaje de ${fieldName}.`;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue) || numberValue < 0 || numberValue > 100) {
    return `El porcentaje de ${fieldName} debe estar entre 0 y 100.`;
  }

  return "";
}

export default function BarberosPage() {
  const {
    negocio,
    colaboradores,
    categoriasColaborador,
    refreshAppData,
  } = useAppData();

  const [activeSection, setActiveSection] = useState("barberos");
  const [searchTerm, setSearchTerm] = useState("");
  const [showInactive, setShowInactive] = useState(false);

  const [barberoForm, setBarberoForm] = useState(emptyBarberoForm);
  const [categoriaForm, setCategoriaForm] = useState(emptyCategoriaForm);
  const [showBarberoForm, setShowBarberoForm] = useState(false);
  const [showCategoriaForm, setShowCategoriaForm] = useState(false);

  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const categoriasById = useMemo(
    () =>
      new Map(
        categoriasColaborador.map((categoria) => [categoria.id, categoria])
      ),
    [categoriasColaborador]
  );

  const categoriasOrdenadas = useMemo(
    () =>
      [...categoriasColaborador].sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
      ),
    [categoriasColaborador]
  );

  const barberosFiltrados = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return [...colaboradores]
      .filter((item) => showInactive || item.activo)
      .filter((item) => {
        if (!normalizedSearch) return true;

        const categoria = categoriasById.get(item.categoria_id);

        return normalizeText(
          `${item.nombre_publico || ""} ${categoria?.nombre || ""}`
        ).includes(normalizedSearch);
      })
      .sort((a, b) =>
        String(a.nombre_publico || "").localeCompare(
          String(b.nombre_publico || ""),
          "es"
        )
      );
  }, [colaboradores, categoriasById, searchTerm, showInactive]);

  const categoriasFiltradas = useMemo(() => {
    const normalizedSearch = normalizeText(searchTerm);

    return categoriasOrdenadas.filter((item) => {
      if (!showInactive && !item.activa) return false;
      if (!normalizedSearch) return true;

      return normalizeText(
        `${item.nombre || ""} ${item.descripcion || ""}`
      ).includes(normalizedSearch);
    });
  }, [categoriasOrdenadas, searchTerm, showInactive]);

  const resumen = useMemo(
    () => ({
      barberosActivos: colaboradores.filter(
        (item) => item.activo && item.es_barbero
      ).length,
      propietarios: colaboradores.filter(
        (item) => item.activo && item.es_propietario
      ).length,
      puestosActivos: categoriasColaborador.filter((item) => item.activa).length,
    }),
    [colaboradores, categoriasColaborador]
  );

  function resetBarberoForm() {
    setBarberoForm(emptyBarberoForm);
    setShowBarberoForm(false);
  }

  function resetCategoriaForm() {
    setCategoriaForm(emptyCategoriaForm);
    setShowCategoriaForm(false);
  }

  function startNewBarbero() {
    setFeedback("");
    setBarberoForm(emptyBarberoForm);
    setShowBarberoForm(true);
  }

  function editBarbero(item) {
    setFeedback("");
    setBarberoForm({
      id: item.id,
      nombre_publico: item.nombre_publico || "",
      categoria_id: item.categoria_id || "",
      es_barbero: Boolean(item.es_barbero),
      es_propietario: Boolean(item.es_propietario),
      usa_comision_personalizada:
        item.porcentaje_comision_default !== null &&
        item.porcentaje_comision_default !== undefined,
      porcentaje_comision_default:
        item.porcentaje_comision_default !== null &&
        item.porcentaje_comision_default !== undefined
          ? String(item.porcentaje_comision_default)
          : "",
      frecuencia_pago_default: item.frecuencia_pago_default || "",
      activo: Boolean(item.activo),
    });
    setShowBarberoForm(true);
  }

  function startNewCategoria() {
    setFeedback("");
    setCategoriaForm(emptyCategoriaForm);
    setShowCategoriaForm(true);
  }

  function editCategoria(item) {
    setFeedback("");
    setCategoriaForm({
      id: item.id,
      nombre: item.nombre || "",
      descripcion: item.descripcion || "",
      usa_comision_default:
        item.porcentaje_comision_default !== null &&
        item.porcentaje_comision_default !== undefined,
      porcentaje_comision_default:
        item.porcentaje_comision_default !== null &&
        item.porcentaje_comision_default !== undefined
          ? String(item.porcentaje_comision_default)
          : "",
      frecuencia_pago_default: item.frecuencia_pago_default || "manual",
      activa: Boolean(item.activa),
    });
    setShowCategoriaForm(true);
  }

  async function saveBarbero(event) {
    event.preventDefault();

    if (!negocio?.id) {
      setFeedback("No se encontró el negocio actual.");
      return;
    }

    const cleanName = String(barberoForm.nombre_publico || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!cleanName) {
      setFeedback("Ingresá el nombre público del colaborador.");
      return;
    }

    const percentageError = validatePercentage(
      barberoForm.porcentaje_comision_default,
      barberoForm.usa_comision_personalizada,
      "la comisión personalizada"
    );

    if (percentageError) {
      setFeedback(percentageError);
      return;
    }

    const payload = {
      negocio_id: negocio.id,
      nombre_publico: cleanName,
      categoria_id: barberoForm.categoria_id || null,
      es_barbero: barberoForm.es_barbero,
      es_propietario: barberoForm.es_propietario,
      porcentaje_comision_default: barberoForm.usa_comision_personalizada
        ? Number(barberoForm.porcentaje_comision_default)
        : null,
      frecuencia_pago_default:
        barberoForm.frecuencia_pago_default || null,
      activo: barberoForm.activo,
    };

    try {
      setIsSaving(true);
      setFeedback("");

      if (barberoForm.id) {
        const { error } = await supabase
          .from("colaboradores")
          .update(payload)
          .eq("id", barberoForm.id)
          .eq("negocio_id", negocio.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("colaboradores")
          .insert(payload);

        if (error) throw error;
      }

      await refreshAppData();
      resetBarberoForm();
      setFeedback(
        barberoForm.id
          ? "Colaborador actualizado correctamente."
          : "Colaborador creado correctamente."
      );
    } catch (error) {
      console.error("Error guardando colaborador:", error);
      setFeedback(
        error?.message || "No se pudo guardar el colaborador."
      );
    } finally {
      setIsSaving(false);
    }
  }

  async function saveCategoria(event) {
    event.preventDefault();

    if (!negocio?.id) {
      setFeedback("No se encontró el negocio actual.");
      return;
    }

    const cleanName = String(categoriaForm.nombre || "")
      .trim()
      .replace(/\s+/g, " ");

    if (!cleanName) {
      setFeedback("Ingresá el nombre del puesto.");
      return;
    }

    const percentageError = validatePercentage(
      categoriaForm.porcentaje_comision_default,
      categoriaForm.usa_comision_default,
      "la comisión del puesto"
    );

    if (percentageError) {
      setFeedback(percentageError);
      return;
    }

    const payload = {
      negocio_id: negocio.id,
      nombre: cleanName,
      descripcion:
        String(categoriaForm.descripcion || "").trim() || null,
      porcentaje_comision_default: categoriaForm.usa_comision_default
        ? Number(categoriaForm.porcentaje_comision_default)
        : null,
      frecuencia_pago_default:
        categoriaForm.frecuencia_pago_default || "manual",
      activa: categoriaForm.activa,
    };

    try {
      setIsSaving(true);
      setFeedback("");

      if (categoriaForm.id) {
        const { error } = await supabase
          .from("categorias_colaborador")
          .update(payload)
          .eq("id", categoriaForm.id)
          .eq("negocio_id", negocio.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("categorias_colaborador")
          .insert(payload);

        if (error) throw error;
      }

      await refreshAppData();
      resetCategoriaForm();
      setFeedback(
        categoriaForm.id
          ? "Puesto actualizado correctamente."
          : "Puesto creado correctamente."
      );
    } catch (error) {
      console.error("Error guardando puesto:", error);

      if (error?.code === "23505") {
        setFeedback("Ya existe un puesto con ese nombre.");
      } else {
        setFeedback(error?.message || "No se pudo guardar el puesto.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleBarberoActive(item) {
    const nextActive = !item.activo;

    const confirmed = window.confirm(
      nextActive
        ? `¿Reactivar a ${item.nombre_publico}?`
        : `¿Desactivar a ${item.nombre_publico}? No se eliminará su historial.`
    );

    if (!confirmed) return;

    try {
      setIsSaving(true);
      setFeedback("");

      const { error } = await supabase
        .from("colaboradores")
        .update({ activo: nextActive })
        .eq("id", item.id)
        .eq("negocio_id", negocio.id);

      if (error) throw error;

      await refreshAppData();
      setFeedback(
        nextActive
          ? "Colaborador reactivado."
          : "Colaborador desactivado sin borrar su historial."
      );
    } catch (error) {
      console.error("Error cambiando estado del colaborador:", error);
      setFeedback("No se pudo cambiar el estado del colaborador.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleCategoriaActive(item) {
    const nextActive = !item.activa;

    const confirmed = window.confirm(
      nextActive
        ? `¿Reactivar el puesto ${item.nombre}?`
        : `¿Desactivar el puesto ${item.nombre}? Los colaboradores seguirán vinculados, pero el puesto dejará de ofrecerse para nuevas asignaciones.`
    );

    if (!confirmed) return;

    try {
      setIsSaving(true);
      setFeedback("");

      const { error } = await supabase
        .from("categorias_colaborador")
        .update({ activa: nextActive })
        .eq("id", item.id)
        .eq("negocio_id", negocio.id);

      if (error) throw error;

      await refreshAppData();
      setFeedback(
        nextActive ? "Puesto reactivado." : "Puesto desactivado."
      );
    } catch (error) {
      console.error("Error cambiando estado del puesto:", error);
      setFeedback("No se pudo cambiar el estado del puesto.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Equipo y comisiones</span>
        <h2>Barberos y puestos</h2>
        <p>
          Administrá colaboradores, puestos y valores predeterminados de
          comisión. Las reglas particulares por servicio se configurarán en el
          siguiente paso.
        </p>
      </section>

      <section className="barberos-summary-grid">
        <article className="barberos-summary-card">
          <FiUserCheck />
          <span>Barberos activos</span>
          <strong>{resumen.barberosActivos}</strong>
        </article>

        <article className="barberos-summary-card">
          <FiUsers />
          <span>Propietarios activos</span>
          <strong>{resumen.propietarios}</strong>
        </article>

        <article className="barberos-summary-card">
          <FiBriefcase />
          <span>Puestos activos</span>
          <strong>{resumen.puestosActivos}</strong>
        </article>
      </section>

      <section className="barberos-tabs">
        <button
          type="button"
          className={activeSection === "barberos" ? "is-active" : ""}
          onClick={() => {
            setActiveSection("barberos");
            setSearchTerm("");
            setFeedback("");
          }}
        >
          <FiUsers />
          Barberos
        </button>

        <button
          type="button"
          className={activeSection === "puestos" ? "is-active" : ""}
          onClick={() => {
            setActiveSection("puestos");
            setSearchTerm("");
            setFeedback("");
          }}
        >
          <FiBriefcase />
          Puestos
        </button>
      </section>

      <section className="work-card barberos-toolbar-card">
        <label className="form-field barberos-search-field">
          <span>Buscar</span>
          <div className="barberos-search-input">
            <FiSearch />
            <input
              type="search"
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder={
                activeSection === "barberos"
                  ? "Nombre o puesto..."
                  : "Nombre o descripción..."
              }
            />
          </div>
        </label>

        <label className="barberos-show-inactive">
          <input
            type="checkbox"
            checked={showInactive}
            onChange={(event) => setShowInactive(event.target.checked)}
          />
          Mostrar inactivos
        </label>

        <button
          type="button"
          className="btn btn-primary"
          onClick={
            activeSection === "barberos"
              ? startNewBarbero
              : startNewCategoria
          }
        >
          <FiPlus />
          {activeSection === "barberos"
            ? "Nuevo barbero"
            : "Nuevo puesto"}
        </button>
      </section>

      {feedback && <p className="form-feedback">{feedback}</p>}

      {activeSection === "barberos" && (
        <>
          {showBarberoForm && (
            <form className="work-card barberos-form-card" onSubmit={saveBarbero}>
              <div className="barberos-form-heading">
                <div>
                  <strong>
                    {barberoForm.id
                      ? "Editar colaborador"
                      : "Nuevo colaborador"}
                  </strong>
                  <small>
                    La comisión personalizada tiene prioridad sobre el puesto y
                    el servicio.
                  </small>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={resetBarberoForm}
                  aria-label="Cerrar formulario"
                >
                  <FiX />
                </button>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Nombre público</span>
                  <input
                    type="text"
                    value={barberoForm.nombre_publico}
                    onChange={(event) =>
                      setBarberoForm((current) => ({
                        ...current,
                        nombre_publico: capitalizeFirstLetter(
                          event.target.value
                        ),
                      }))
                    }
                    placeholder="Ej: Juan Pérez"
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Puesto</span>
                  <select
                    value={barberoForm.categoria_id}
                    onChange={(event) =>
                      setBarberoForm((current) => ({
                        ...current,
                        categoria_id: event.target.value,
                      }))
                    }
                  >
                    <option value="">Sin puesto asignado</option>
                    {categoriasOrdenadas
                      .filter(
                        (categoria) =>
                          categoria.activa ||
                          categoria.id === barberoForm.categoria_id
                      )
                      .map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.nombre}
                          {!categoria.activa ? " · Inactivo" : ""}
                        </option>
                      ))}
                  </select>
                </label>

                <label className="form-field">
                  <span>Frecuencia de pago</span>
                  <select
                    value={barberoForm.frecuencia_pago_default}
                    onChange={(event) =>
                      setBarberoForm((current) => ({
                        ...current,
                        frecuencia_pago_default: event.target.value,
                      }))
                    }
                  >
                    <option value="">Heredar del puesto</option>
                    {FRECUENCIAS.map((frecuencia) => (
                      <option
                        key={frecuencia.value}
                        value={frecuencia.value}
                      >
                        {frecuencia.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="barberos-option-grid">
                <label className="barberos-check-card">
                  <input
                    type="checkbox"
                    checked={barberoForm.es_barbero}
                    onChange={(event) =>
                      setBarberoForm((current) => ({
                        ...current,
                        es_barbero: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Trabaja como barbero</strong>
                    <small>Puede recibir servicios y comisiones.</small>
                  </span>
                </label>

                <label className="barberos-check-card">
                  <input
                    type="checkbox"
                    checked={barberoForm.es_propietario}
                    onChange={(event) =>
                      setBarberoForm((current) => ({
                        ...current,
                        es_propietario: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Es propietario</strong>
                    <small>Identifica al dueño dentro del equipo.</small>
                  </span>
                </label>

                <label className="barberos-check-card">
                  <input
                    type="checkbox"
                    checked={barberoForm.activo}
                    onChange={(event) =>
                      setBarberoForm((current) => ({
                        ...current,
                        activo: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Colaborador activo</strong>
                    <small>Aparece disponible para nuevas operaciones.</small>
                  </span>
                </label>
              </div>

              <section className="barberos-commission-box">
                <label className="barberos-check-card">
                  <input
                    type="checkbox"
                    checked={barberoForm.usa_comision_personalizada}
                    onChange={(event) =>
                      setBarberoForm((current) => ({
                        ...current,
                        usa_comision_personalizada: event.target.checked,
                        porcentaje_comision_default: event.target.checked
                          ? current.porcentaje_comision_default
                          : "",
                      }))
                    }
                  />
                  <span>
                    <strong>Usar comisión personalizada</strong>
                    <small>
                      Tiene prioridad sobre la comisión del puesto y del
                      servicio.
                    </small>
                  </span>
                </label>

                {barberoForm.usa_comision_personalizada && (
                  <label className="form-field">
                    <span>Porcentaje personalizado</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={barberoForm.porcentaje_comision_default}
                      onKeyDown={preventInvalidNumberKeys}
                      onChange={(event) =>
                        setBarberoForm((current) => ({
                          ...current,
                          porcentaje_comision_default:
                            normalizePercentageInput(event.target.value),
                        }))
                      }
                      placeholder="Ej: 40"
                    />
                  </label>
                )}
              </section>

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetBarberoForm}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  <FiSave />
                  {isSaving ? "Guardando..." : "Guardar colaborador"}
                </button>
              </div>
            </form>
          )}

          <section className="barberos-card-list">
            {barberosFiltrados.length === 0 ? (
              <div className="work-card empty-state">
                No hay colaboradores que coincidan con la búsqueda.
              </div>
            ) : (
              barberosFiltrados.map((item) => {
                const categoria = categoriasById.get(item.categoria_id);
                const effectiveCommission = getEffectiveCommission(
                  item,
                  categoria
                );

                return (
                  <article
                    key={item.id}
                    className={`work-card barbero-card ${
                      !item.activo ? "is-inactive" : ""
                    }`}
                  >
                    <div className="barbero-card__main">
                      <div className="barbero-card__avatar">
                        {String(item.nombre_publico || "?")
                          .trim()
                          .charAt(0)
                          .toUpperCase()}
                      </div>

                      <div>
                        <div className="barbero-card__title">
                          <strong>{item.nombre_publico}</strong>
                          {!item.activo && (
                            <span className="barberos-status is-inactive">
                              Inactivo
                            </span>
                          )}
                          {item.es_propietario && (
                            <span className="barberos-status">
                              Propietario
                            </span>
                          )}
                        </div>

                        <small>
                          {categoria?.nombre || "Sin puesto asignado"}
                          {item.es_barbero ? " · Barbero" : " · Colaborador"}
                        </small>
                      </div>
                    </div>

                    <div className="barbero-card__details">
                      <div>
                        <span>Comisión efectiva</span>
                        <strong>
                          {percentageLabel(effectiveCommission.value)}
                        </strong>
                        <small>{effectiveCommission.source}</small>
                      </div>

                      <div>
                        <span>Frecuencia</span>
                        <strong>
                          {frequencyLabel(item.frecuencia_pago_default)}
                        </strong>
                        <small>
                          {item.frecuencia_pago_default
                            ? "Configuración personal"
                            : categoria
                              ? `Puesto: ${frequencyLabel(
                                  categoria.frecuencia_pago_default
                                )}`
                              : "Sin puesto configurado"}
                        </small>
                      </div>
                    </div>

                    <div className="barbero-card__actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => editBarbero(item)}
                      >
                        <FiEdit2 />
                        Editar
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => toggleBarberoActive(item)}
                        disabled={isSaving}
                      >
                        {item.activo ? <FiToggleRight /> : <FiToggleLeft />}
                        {item.activo ? "Desactivar" : "Reactivar"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </>
      )}

      {activeSection === "puestos" && (
        <>
          {showCategoriaForm && (
            <form className="work-card barberos-form-card" onSubmit={saveCategoria}>
              <div className="barberos-form-heading">
                <div>
                  <strong>
                    {categoriaForm.id ? "Editar puesto" : "Nuevo puesto"}
                  </strong>
                  <small>
                    La comisión del puesto se usa cuando el barbero no tiene una
                    personalizada.
                  </small>
                </div>

                <button
                  type="button"
                  className="icon-button"
                  onClick={resetCategoriaForm}
                  aria-label="Cerrar formulario"
                >
                  <FiX />
                </button>
              </div>

              <div className="form-grid">
                <label className="form-field">
                  <span>Nombre del puesto</span>
                  <input
                    type="text"
                    value={categoriaForm.nombre}
                    onChange={(event) =>
                      setCategoriaForm((current) => ({
                        ...current,
                        nombre: capitalizeFirstLetter(event.target.value),
                      }))
                    }
                    placeholder="Ej: Barbero senior"
                    required
                  />
                </label>

                <label className="form-field">
                  <span>Frecuencia de pago predeterminada</span>
                  <select
                    value={categoriaForm.frecuencia_pago_default}
                    onChange={(event) =>
                      setCategoriaForm((current) => ({
                        ...current,
                        frecuencia_pago_default: event.target.value,
                      }))
                    }
                  >
                    {FRECUENCIAS.map((frecuencia) => (
                      <option
                        key={frecuencia.value}
                        value={frecuencia.value}
                      >
                        {frecuencia.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="form-field barberos-description-field">
                  <span>Descripción</span>
                  <textarea
                    rows="3"
                    value={categoriaForm.descripcion}
                    onChange={(event) =>
                      setCategoriaForm((current) => ({
                        ...current,
                        descripcion: capitalizeFirstLetter(
                          event.target.value
                        ),
                      }))
                    }
                    placeholder="Opcional"
                  />
                </label>
              </div>

              <div className="barberos-option-grid">
                <label className="barberos-check-card">
                  <input
                    type="checkbox"
                    checked={categoriaForm.activa}
                    onChange={(event) =>
                      setCategoriaForm((current) => ({
                        ...current,
                        activa: event.target.checked,
                      }))
                    }
                  />
                  <span>
                    <strong>Puesto activo</strong>
                    <small>Disponible para asignar a colaboradores.</small>
                  </span>
                </label>

                <label className="barberos-check-card">
                  <input
                    type="checkbox"
                    checked={categoriaForm.usa_comision_default}
                    onChange={(event) =>
                      setCategoriaForm((current) => ({
                        ...current,
                        usa_comision_default: event.target.checked,
                        porcentaje_comision_default: event.target.checked
                          ? current.porcentaje_comision_default
                          : "",
                      }))
                    }
                  />
                  <span>
                    <strong>Usar comisión predeterminada</strong>
                    <small>
                      Se aplica si el barbero no tiene una personalizada.
                    </small>
                  </span>
                </label>
              </div>

              {categoriaForm.usa_comision_default && (
                <section className="barberos-commission-box">
                  <label className="form-field">
                    <span>Porcentaje del puesto</span>
                    <input
                      type="text"
                      inputMode="decimal"
                      value={categoriaForm.porcentaje_comision_default}
                      onKeyDown={preventInvalidNumberKeys}
                      onChange={(event) =>
                        setCategoriaForm((current) => ({
                          ...current,
                          porcentaje_comision_default:
                            normalizePercentageInput(event.target.value),
                        }))
                      }
                      placeholder="Ej: 35"
                    />
                  </label>
                </section>
              )}

              <div className="form-actions">
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetCategoriaForm}
                >
                  Cancelar
                </button>

                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSaving}
                >
                  <FiSave />
                  {isSaving ? "Guardando..." : "Guardar puesto"}
                </button>
              </div>
            </form>
          )}

          <section className="barberos-card-list">
            {categoriasFiltradas.length === 0 ? (
              <div className="work-card empty-state">
                No hay puestos que coincidan con la búsqueda.
              </div>
            ) : (
              categoriasFiltradas.map((item) => {
                const assignedCount = colaboradores.filter(
                  (colaborador) => colaborador.categoria_id === item.id
                ).length;

                return (
                  <article
                    key={item.id}
                    className={`work-card puesto-card ${
                      !item.activa ? "is-inactive" : ""
                    }`}
                  >
                    <div className="puesto-card__header">
                      <div>
                        <div className="barbero-card__title">
                          <strong>{item.nombre}</strong>
                          {!item.activa && (
                            <span className="barberos-status is-inactive">
                              Inactivo
                            </span>
                          )}
                        </div>

                        <small>
                          {item.descripcion || "Sin descripción"}
                        </small>
                      </div>

                      <FiBriefcase />
                    </div>

                    <div className="puesto-card__metrics">
                      <div>
                        <span>Comisión predeterminada</span>
                        <strong>
                          {percentageLabel(
                            item.porcentaje_comision_default
                          )}
                        </strong>
                      </div>

                      <div>
                        <span>Frecuencia</span>
                        <strong>
                          {frequencyLabel(item.frecuencia_pago_default)}
                        </strong>
                      </div>

                      <div>
                        <span>Colaboradores asignados</span>
                        <strong>{assignedCount}</strong>
                      </div>
                    </div>

                    <div className="barbero-card__actions">
                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => editCategoria(item)}
                      >
                        <FiEdit2 />
                        Editar
                      </button>

                      <button
                        type="button"
                        className="btn btn-ghost"
                        onClick={() => toggleCategoriaActive(item)}
                        disabled={isSaving}
                      >
                        {item.activa ? <FiToggleRight /> : <FiToggleLeft />}
                        {item.activa ? "Desactivar" : "Reactivar"}
                      </button>
                    </div>
                  </article>
                );
              })
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}
