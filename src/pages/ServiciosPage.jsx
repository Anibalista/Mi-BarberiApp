import { useEffect, useMemo, useState } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiEdit2,
  FiPlus,
  FiRefreshCw,
  FiSave,
  FiTrash2,
  FiX,
} from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../lib/supabaseClient";
import {
  capitalizeFirstLetter,
  normalizeText,
  onlyPositiveNumber,
  preventInvalidNumberKeys,
} from "../utils/formGuards";
import { formatCurrency, formatNumber } from "../utils/formatters";

const emptyServiceForm = {
  id: null,
  nombre: "",
  descripcion: "",
  precio_lista: "",
  precio_efectivo: "",
  duracion_minutos: "",
  activo: true,
};

function createEmptyCost() {
  return {
    tempId: crypto.randomUUID(),
    id: null,
    origen: "manual",
    tipo_costo: "variable",
    producto_id: null,
    producto_nombre: "",
    descripcion: "",
    cantidad: "1",
    unidad_medida: "unidad",
    costo_unitario: "",
    costo_total: "",
    activo: true,
  };
}

function normalizeServicePayload(form, negocioId) {
  return {
    negocio_id: negocioId,
    nombre: capitalizeFirstLetter(form.nombre).trim(),
    descripcion: form.descripcion.trim() || null,
    precio_lista: Number(form.precio_lista || 0),
    precio_efectivo: Number(form.precio_efectivo || 0),
    duracion_minutos: form.duracion_minutos
      ? Number(form.duracion_minutos)
      : null,
    activo: Boolean(form.activo),
  };
}

function calculateCostTotal(cantidad, costoUnitario) {
  return Number(cantidad || 0) * Number(costoUnitario || 0);
}

export default function ServiciosPage() {
  const { negocio, productos, refreshAppData } = useAppData();

  const [servicios, setServicios] = useState([]);
  const [servicioCostos, setServicioCostos] = useState([]);
  const [form, setForm] = useState(emptyServiceForm);
  const [costos, setCostos] = useState([createEmptyCost()]);
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(true);
  const [sortConfig, setSortConfig] = useState({
    key: "nombre",
    direction: "asc",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const productosInsumo = useMemo(
    () =>
      productos
        .filter((producto) => producto.disponible_insumo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [productos]
  );

  const isEditing = Boolean(form.id);

  async function loadServiciosData() {
    if (!negocio?.id) return;

    try {
      setIsLoading(true);
      setFeedback("");

      const [serviciosResult, costosResult] = await Promise.all([
        supabase
          .from("servicios")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre", { ascending: true }),

        supabase
          .from("servicio_costos")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("descripcion", { ascending: true }),
      ]);

      if (serviciosResult.error) throw serviciosResult.error;
      if (costosResult.error) throw costosResult.error;

      setServicios(serviciosResult.data ?? []);
      setServicioCostos(costosResult.data ?? []);
    } catch (error) {
      console.error("Error cargando servicios:", error);
      setFeedback("No se pudieron cargar los servicios.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadServiciosData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id]);

  const filteredServicios = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    const result = servicios.filter((servicio) => {
      const matchesSearch = normalizeText(
        `${servicio.nombre || ""} ${servicio.descripcion || ""}`
      ).includes(normalizedSearch);

      const matchesActive = showInactive ? true : servicio.activo;

      return matchesSearch && matchesActive;
    });

    return [...result].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "nombre") {
        return a.nombre.localeCompare(b.nombre, "es") * direction;
      }

      if (sortConfig.key === "precio_lista") {
        return (Number(a.precio_lista) - Number(b.precio_lista)) * direction;
      }

      if (sortConfig.key === "precio_efectivo") {
        return (
          (Number(a.precio_efectivo) - Number(b.precio_efectivo)) * direction
        );
      }

      if (sortConfig.key === "duracion_minutos") {
        return (
          (Number(a.duracion_minutos || 0) -
            Number(b.duracion_minutos || 0)) *
          direction
        );
      }

      if (sortConfig.key === "activo") {
        return (Number(b.activo) - Number(a.activo)) * direction;
      }

      return 0;
    });
  }, [servicios, search, showInactive, sortConfig]);

  function updateSort(key) {
    setSortConfig((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: "asc",
      };
    });
  }

  function SortIcon({ columnKey }) {
    if (sortConfig.key !== columnKey) return null;

    return sortConfig.direction === "asc" ? <FiArrowUp /> : <FiArrowDown />;
  }

  function updateFormField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: field === "nombre" ? capitalizeFirstLetter(value) : value,
    }));
  }

  function updateNumericFormField(field, value) {
    setForm((current) => ({
      ...current,
      [field]: onlyPositiveNumber(value),
    }));
  }

  function updateCost(tempId, field, value) {
    setCostos((current) =>
      current.map((cost) => {
        if (cost.tempId !== tempId) return cost;

        const updatedCost = {
          ...cost,
          [field]: value,
        };

        if (field === "descripcion") {
          updatedCost.descripcion = capitalizeFirstLetter(value);
        }

        if (field === "cantidad" || field === "costo_unitario") {
          updatedCost[field] = onlyPositiveNumber(value);
          updatedCost.costo_total = String(
            calculateCostTotal(
              field === "cantidad" ? updatedCost[field] : updatedCost.cantidad,
              field === "costo_unitario"
                ? updatedCost[field]
                : updatedCost.costo_unitario
            )
          );
        }

        if (field === "costo_total") {
          updatedCost.costo_total = onlyPositiveNumber(value);
        }

        if (field === "origen" && value === "manual") {
          updatedCost.producto_id = null;
          updatedCost.producto_nombre = "";
        }

        return updatedCost;
      })
    );
  }

  function handleProductAutocomplete(tempId, productName) {
    const selectedProduct = productosInsumo.find(
      (producto) => normalizeText(producto.nombre) === normalizeText(productName)
    );

    setCostos((current) =>
      current.map((cost) => {
        if (cost.tempId !== tempId) return cost;

        if (!selectedProduct) {
          return {
            ...cost,
            producto_id: null,
            producto_nombre: productName,
          };
        }

        const cantidad =
          selectedProduct.dosificacion_default > 0
            ? String(selectedProduct.dosificacion_default)
            : cost.cantidad;

        const unidad =
          selectedProduct.unidad_contenido ||
          selectedProduct.unidad_medida ||
          "unidad";

        const costoUnitario = String(selectedProduct.costo_unitario || 0);

        return {
          ...cost,
          origen: "producto",
          producto_id: selectedProduct.id,
          producto_nombre: selectedProduct.nombre,
          descripcion: selectedProduct.nombre,
          cantidad,
          unidad_medida: unidad,
          costo_unitario: costoUnitario,
          costo_total: String(calculateCostTotal(cantidad, costoUnitario)),
        };
      })
    );
  }

  function addCostRow() {
    setCostos((current) => [...current, createEmptyCost()]);
  }

  function removeCostRow(tempId) {
    setCostos((current) => {
      if (current.length === 1) return [createEmptyCost()];

      return current.filter((cost) => cost.tempId !== tempId);
    });
  }

  function resetForm() {
    setForm(emptyServiceForm);
    setCostos([createEmptyCost()]);
    setFeedback("");
  }

  function loadServiceForEdit(servicio) {
    const relatedCosts = servicioCostos
      .filter((cost) => cost.servicio_id === servicio.id)
      .map((cost) => {
        const relatedProduct = productos.find(
          (producto) => producto.id === cost.producto_id
        );

        return {
          tempId: crypto.randomUUID(),
          id: cost.id,
          origen: cost.origen,
          tipo_costo: cost.tipo_costo,
          producto_id: cost.producto_id,
          producto_nombre: relatedProduct?.nombre || "",
          descripcion: cost.descripcion || "",
          cantidad: String(cost.cantidad ?? ""),
          unidad_medida: cost.unidad_medida || "unidad",
          costo_unitario: String(cost.costo_unitario ?? ""),
          costo_total: String(cost.costo_total ?? ""),
          activo: cost.activo,
        };
      });

    setForm({
      id: servicio.id,
      nombre: servicio.nombre || "",
      descripcion: servicio.descripcion || "",
      precio_lista: String(servicio.precio_lista ?? ""),
      precio_efectivo: String(servicio.precio_efectivo ?? ""),
      duracion_minutos: String(servicio.duracion_minutos ?? ""),
      activo: servicio.activo,
    });

    setCostos(relatedCosts.length > 0 ? relatedCosts : [createEmptyCost()]);
    setFeedback(`Editando servicio: ${servicio.nombre}`);
  }

  function findDuplicateService() {
    return servicios.find((servicio) => {
      const sameName =
        normalizeText(servicio.nombre) === normalizeText(form.nombre);

      const differentService = servicio.id !== form.id;

      return sameName && differentService;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!negocio?.id) {
      setFeedback("No se encontró el negocio actual.");
      return;
    }

    if (!form.nombre.trim()) {
      setFeedback("El nombre del servicio es obligatorio.");
      return;
    }

    const duplicateService = findDuplicateService();

    if (duplicateService) {
      const shouldEditExisting = window.confirm(
        `Ya existe un servicio llamado "${duplicateService.nombre}". ¿Querés cargarlo para modificarlo?`
      );

      if (shouldEditExisting) {
        loadServiceForEdit(duplicateService);
      }

      return;
    }

    try {
      setIsSaving(true);
      setFeedback("");

      const servicePayload = normalizeServicePayload(form, negocio.id);

      let savedService;

      if (isEditing) {
        const { data, error } = await supabase
          .from("servicios")
          .update(servicePayload)
          .eq("id", form.id)
          .eq("negocio_id", negocio.id)
          .select("*")
          .single();

        if (error) throw error;

        savedService = data;
      } else {
        const { data, error } = await supabase
          .from("servicios")
          .insert(servicePayload)
          .select("*")
          .single();

        if (error) throw error;

        savedService = data;
      }

      const validCosts = costos.filter(
        (cost) =>
          cost.descripcion.trim() ||
          cost.producto_id ||
          Number(cost.costo_total || 0) > 0
      );

      if (isEditing) {
        const { error: deleteError } = await supabase
          .from("servicio_costos")
          .delete()
          .eq("servicio_id", savedService.id)
          .eq("negocio_id", negocio.id);

        if (deleteError) throw deleteError;
      }

      if (validCosts.length > 0) {
        const costPayload = validCosts.map((cost) => ({
          negocio_id: negocio.id,
          servicio_id: savedService.id,
          producto_id: cost.origen === "producto" ? cost.producto_id : null,
          origen: cost.origen,
          tipo_costo: cost.tipo_costo,
          descripcion:
            capitalizeFirstLetter(cost.descripcion).trim() ||
            cost.producto_nombre ||
            "Costo del servicio",
          cantidad: Number(cost.cantidad || 0),
          unidad_medida: cost.unidad_medida || "unidad",
          costo_unitario: Number(cost.costo_unitario || 0),
          costo_total: Number(cost.costo_total || 0),
          activo: Boolean(cost.activo),
        }));

        const { error: insertCostError } = await supabase
          .from("servicio_costos")
          .insert(costPayload);

        if (insertCostError) throw insertCostError;
      }

      setFeedback(
        isEditing
          ? "Servicio actualizado correctamente."
          : "Servicio creado correctamente."
      );

      resetForm();
      await loadServiciosData();
      await refreshAppData();
    } catch (error) {
      console.error("Error guardando servicio:", error);

      if (error?.code === "23505") {
        setFeedback("Ya existe un servicio con ese nombre en la empresa.");
        return;
      }

      setFeedback("No se pudo guardar el servicio.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleServiceActive(servicio) {
    if (!negocio?.id) return;

    try {
      const { error } = await supabase
        .from("servicios")
        .update({ activo: !servicio.activo })
        .eq("id", servicio.id)
        .eq("negocio_id", negocio.id);

      if (error) throw error;

      await loadServiciosData();
      await refreshAppData();
    } catch (error) {
      console.error("Error cambiando estado del servicio:", error);
      setFeedback("No se pudo cambiar el estado del servicio.");
    }
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Servicios</span>
        <h2>ABM de servicios</h2>
        <p>
          Gestioná servicios con precio de lista, precio efectivo, duración,
          insumos y costos asociados.
        </p>
      </section>

      <section className="work-card service-form-card">
        <div className="toolbar">
          <div>
            <strong>{isEditing ? "Modificar servicio" : "Nuevo servicio"}</strong>
            <small>
              El nombre debe ser único por empresa. Los costos pueden ser
              manuales o productos usados como insumo.
            </small>
          </div>

          <button type="button" className="btn btn-ghost" onClick={resetForm}>
            <FiX />
            Limpiar
          </button>
        </div>

        <form className="service-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>Nombre del servicio</span>
              <input
                list="servicios-existentes"
                type="text"
                value={form.nombre}
                onChange={(event) =>
                  updateFormField("nombre", event.target.value)
                }
                placeholder="Ej: Corte"
                required
              />
              <datalist id="servicios-existentes">
                {servicios.map((servicio) => (
                  <option key={servicio.id} value={servicio.nombre} />
                ))}
              </datalist>
            </label>

            <label className="form-field">
              <span>Precio de lista</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.precio_lista}
                onKeyDown={preventInvalidNumberKeys}
                onChange={(event) =>
                  updateNumericFormField("precio_lista", event.target.value)
                }
                placeholder="0"
                required
              />
            </label>

            <label className="form-field">
              <span>Precio efectivo</span>
              <input
                type="number"
                inputMode="decimal"
                min="0"
                value={form.precio_efectivo}
                onKeyDown={preventInvalidNumberKeys}
                onChange={(event) =>
                  updateNumericFormField("precio_efectivo", event.target.value)
                }
                placeholder="0"
                required
              />
            </label>

            <label className="form-field">
              <span>Duración estimada en minutos</span>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                value={form.duracion_minutos}
                onKeyDown={preventInvalidNumberKeys}
                onChange={(event) =>
                  updateNumericFormField("duracion_minutos", event.target.value)
                }
                placeholder="Ej: 30"
              />
            </label>

            <label className="form-field form-field--checkbox">
              <span>Estado</span>
              <button
                type="button"
                className={`status-switch ${form.activo ? "is-active" : ""}`}
                onClick={() =>
                  setForm((current) => ({
                    ...current,
                    activo: !current.activo,
                  }))
                }
              >
                {form.activo ? "Activo" : "Inactivo"}
              </button>
            </label>
          </div>

          <label className="form-field">
            <span>Descripción</span>
            <textarea
              rows="3"
              value={form.descripcion}
              onChange={(event) =>
                updateFormField("descripcion", event.target.value)
              }
              placeholder="Ej: Servicio base de corte de cabello."
            />
          </label>

          <div className="costs-box">
            <div className="toolbar">
              <div>
                <strong>Insumos y costos del servicio</strong>
                <small>
                  Podés asociar productos usados como insumo o cargar costos
                  manuales.
                </small>
              </div>

              <button type="button" className="btn btn-ghost" onClick={addCostRow}>
                <FiPlus />
                Agregar costo
              </button>
            </div>

            <datalist id="productos-insumo">
              {productosInsumo.map((producto) => (
                <option key={producto.id} value={producto.nombre} />
              ))}
            </datalist>

            <div className="costs-list">
              {costos.map((cost) => (
                <article key={cost.tempId} className="cost-row">
                  <div className="cost-row__top">
                    <label className="form-field">
                      <span>Origen</span>
                      <select
                        value={cost.origen}
                        onChange={(event) =>
                          updateCost(cost.tempId, "origen", event.target.value)
                        }
                      >
                        <option value="manual">Manual</option>
                        <option value="producto">Producto / insumo</option>
                      </select>
                    </label>

                    <label className="form-field">
                      <span>Tipo de costo</span>
                      <select
                        value={cost.tipo_costo}
                        onChange={(event) =>
                          updateCost(
                            cost.tempId,
                            "tipo_costo",
                            event.target.value
                          )
                        }
                      >
                        <option value="variable">Variable</option>
                        <option value="fijo">Fijo</option>
                      </select>
                    </label>

                    {cost.origen === "producto" && (
                      <label className="form-field">
                        <span>Producto insumo</span>
                        <input
                          list="productos-insumo"
                          type="text"
                          value={cost.producto_nombre}
                          onChange={(event) =>
                            handleProductAutocomplete(
                              cost.tempId,
                              event.target.value
                            )
                          }
                          placeholder="Buscar producto..."
                        />
                      </label>
                    )}

                    <label className="form-field">
                      <span>Descripción</span>
                      <input
                        type="text"
                        value={cost.descripcion}
                        onChange={(event) =>
                          updateCost(
                            cost.tempId,
                            "descripcion",
                            event.target.value
                          )
                        }
                        placeholder="Ej: Navaja descartable"
                      />
                    </label>
                  </div>

                  <div className="cost-row__bottom">
                    <label className="form-field">
                      <span>Cantidad</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={cost.cantidad}
                        onKeyDown={preventInvalidNumberKeys}
                        onChange={(event) =>
                          updateCost(cost.tempId, "cantidad", event.target.value)
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>Unidad</span>
                      <input
                        list="unidades-medida"
                        type="text"
                        value={cost.unidad_medida}
                        onChange={(event) =>
                          updateCost(
                            cost.tempId,
                            "unidad_medida",
                            event.target.value
                          )
                        }
                        placeholder="unidad"
                      />
                    </label>

                    <label className="form-field">
                      <span>Costo unitario</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={cost.costo_unitario}
                        onKeyDown={preventInvalidNumberKeys}
                        onChange={(event) =>
                          updateCost(
                            cost.tempId,
                            "costo_unitario",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <label className="form-field">
                      <span>Costo total</span>
                      <input
                        type="number"
                        inputMode="decimal"
                        min="0"
                        value={cost.costo_total}
                        onKeyDown={preventInvalidNumberKeys}
                        onChange={(event) =>
                          updateCost(
                            cost.tempId,
                            "costo_total",
                            event.target.value
                          )
                        }
                      />
                    </label>

                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeCostRow(cost.tempId)}
                      aria-label="Quitar costo"
                    >
                      <FiTrash2 />
                    </button>
                  </div>
                </article>
              ))}
            </div>

            <datalist id="unidades-medida">
              <option value="unidad" />
              <option value="ml" />
              <option value="gr" />
              <option value="cm3" />
              <option value="uso" />
              <option value="minuto" />
            </datalist>
          </div>

          {feedback && <p className="form-feedback">{feedback}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              <FiX />
              Cancelar
            </button>

            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              <FiSave />
              {isSaving
                ? "Guardando..."
                : isEditing
                  ? "Actualizar servicio"
                  : "Crear servicio"}
            </button>
          </div>
        </form>
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>Servicios cargados</strong>
            <small>
              Lista ordenada alfabéticamente por defecto. Podés ordenar por las
              columnas principales.
            </small>
          </div>

          <div className="toolbar-actions">
            <label className="search-box">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar servicio..."
              />
            </label>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={() => setShowInactive((current) => !current)}
            >
              {showInactive ? "Ocultar inactivos" : "Mostrar inactivos"}
            </button>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={loadServiciosData}
            >
              <FiRefreshCw />
              Actualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="empty-state">Cargando servicios...</p>
        ) : filteredServicios.length === 0 ? (
          <p className="empty-state">No hay servicios para mostrar.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => updateSort("nombre")}>
                      Servicio <SortIcon columnKey="nombre" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      onClick={() => updateSort("precio_lista")}
                    >
                      Lista <SortIcon columnKey="precio_lista" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      onClick={() => updateSort("precio_efectivo")}
                    >
                      Efectivo <SortIcon columnKey="precio_efectivo" />
                    </button>
                  </th>
                  <th>
                    <button
                      type="button"
                      onClick={() => updateSort("duracion_minutos")}
                    >
                      Duración <SortIcon columnKey="duracion_minutos" />
                    </button>
                  </th>
                  <th>Costos</th>
                  <th>
                    <button type="button" onClick={() => updateSort("activo")}>
                      Estado <SortIcon columnKey="activo" />
                    </button>
                  </th>
                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredServicios.map((servicio) => {
                  const relatedCosts = servicioCostos.filter(
                    (cost) => cost.servicio_id === servicio.id && cost.activo
                  );

                  const totalCost = relatedCosts.reduce(
                    (acc, cost) => acc + Number(cost.costo_total || 0),
                    0
                  );

                  return (
                    <tr key={servicio.id}>
                      <td>
                        <strong>{servicio.nombre}</strong>
                        <small>{servicio.descripcion || "Sin descripción"}</small>
                      </td>

                      <td>{formatCurrency(servicio.precio_lista)}</td>
                      <td>{formatCurrency(servicio.precio_efectivo)}</td>

                      <td>
                        {servicio.duracion_minutos
                          ? `${servicio.duracion_minutos} min`
                          : "Sin dato"}
                      </td>

                      <td>
                        <strong>{formatCurrency(totalCost)}</strong>
                        <small>
                          {relatedCosts.length} costo
                          {relatedCosts.length === 1 ? "" : "s"}
                        </small>
                      </td>

                      <td>
                        <span
                          className={`status-pill ${
                            servicio.activo ? "is-active" : "is-inactive"
                          }`}
                        >
                          {servicio.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => loadServiceForEdit(servicio)}
                            aria-label="Editar servicio"
                          >
                            <FiEdit2 />
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() => toggleServiceActive(servicio)}
                          >
                            {servicio.activo ? "Desactivar" : "Activar"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}