import { useEffect, useMemo, useState } from "react";
import {
  FiArrowDown,
  FiArrowUp,
  FiEdit2,
  FiRefreshCw,
  FiSave,
  FiX,
} from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../lib/supabaseClient";
import {
  capitalizeFirstLetter,
  normalizeText,
} from "../utils/formGuards";
import { formatCurrency, formatNumber } from "../utils/formatters";

const emptyProductForm = {
  id: null,
  codigo: "",
  nombre: "",
  descripcion: "",
  precio_lista: "",
  precio_efectivo: "",
  costo_unitario: "",
  stock_actual: "",
  stock_minimo: "",
  disponible_venta: true,
  disponible_insumo: false,
  unidad_medida: "",
  cantidad_suelta: "",
  contenido_por_unidad: "1",
  unidad_contenido: "",
  dosificacion_default: "",
  activo: true,
};

const fallbackUnidadesMedida = [
  { codigo: "unidad", nombre: "Unidades" },
  { codigo: "gr", nombre: "Gramos" },
  { codigo: "ml", nombre: "Mililitros" },
  { codigo: "cc", nombre: "Centímetros cúbicos" },
  { codigo: "mm", nombre: "Milímetros" },
  { codigo: "cm", nombre: "Centímetros" },
  { codigo: "lt", nombre: "Litros" },
  { codigo: "kg", nombre: "Kilogramos" },
];

function normalizeDecimalInput(value) {
  const cleanValue = String(value || "").replace(/\./g, ",");

  if (cleanValue === "") return "";

  const onlyValidChars = cleanValue.replace(/[^\d,]/g, "");
  const [integerPart, ...decimalParts] = onlyValidChars.split(",");

  if (decimalParts.length === 0) {
    return integerPart;
  }

  return `${integerPart},${decimalParts.join("")}`;
}

function normalizeIntegerInput(value) {
  return String(value || "").replace(/\D/g, "");
}

function parseDecimal(value) {
  if (value === "" || value === null || value === undefined) return 0;

  const normalizedValue = String(value).replace(",", ".");
  const numberValue = Number(normalizedValue);

  return Number.isFinite(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function parseInteger(value) {
  if (value === "" || value === null || value === undefined) return 0;

  const normalizedValue = String(value).replace(/\D/g, "");
  const numberValue = Number(normalizedValue);

  return Number.isInteger(numberValue) && numberValue >= 0 ? numberValue : 0;
}

function numberToInputValue(value) {
  if (value === null || value === undefined || value === "") return "";

  return String(value).replace(".", ",");
}


function normalizeProductPayload(form, negocioId) {
  return {
    negocio_id: negocioId,
    codigo: form.codigo.trim() || null,
    nombre: capitalizeFirstLetter(form.nombre).trim(),
    descripcion: form.descripcion.trim() || null,
    precio_lista: parseDecimal(form.precio_lista),
    precio_efectivo: parseDecimal(form.precio_efectivo),
    costo_unitario: parseDecimal(form.costo_unitario),
    stock_actual: parseInteger(form.stock_actual),
    stock_minimo: parseInteger(form.stock_minimo),
    disponible_venta: Boolean(form.disponible_venta),
    disponible_insumo: Boolean(form.disponible_insumo),
    unidad_medida: form.unidad_medida.trim() || "unidad",
    cantidad_suelta: parseDecimal(form.cantidad_suelta),
    contenido_por_unidad: parseDecimal(form.contenido_por_unidad) || 1,
    unidad_contenido: form.unidad_contenido.trim() || "unidad",
    dosificacion_default: parseDecimal(form.dosificacion_default),
    activo: Boolean(form.activo),
  };
}

function suggestNextCode(productos) {
  const validCodes = productos
    .map((producto) => Number(producto.codigo))
    .filter((codigo) => Number.isInteger(codigo))
    .filter((codigo) => codigo >= 1000000 && codigo <= 9999999);

  if (validCodes.length === 0) {
    return "1000000";
  }

  const nextCode = Math.max(...validCodes) + 1;

  if (nextCode > 9999999) {
    return "";
  }

  return String(nextCode);
}

export default function ProductosPage() {
  const { negocio, unidadesMedida, refreshAppData } = useAppData();

  const [productos, setProductos] = useState([]);
  const [form, setForm] = useState(emptyProductForm);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState("activos");
  const [stockFilter, setStockFilter] = useState("todos");
  const [usageFilter, setUsageFilter] = useState("todos");

  const [sortConfig, setSortConfig] = useState({
    key: "nombre",
    direction: "asc",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const isEditing = Boolean(form.id);

  const unidadesSugeridas = useMemo(() => {
    const source =
      Array.isArray(unidadesMedida) && unidadesMedida.length > 0
        ? unidadesMedida
        : fallbackUnidadesMedida;

    return [...source].sort((a, b) => {
      const ordenA = Number(a.orden ?? 999);
      const ordenB = Number(b.orden ?? 999);

      if (ordenA !== ordenB) {
        return ordenA - ordenB;
      }

      return String(a.codigo).localeCompare(String(b.codigo), "es");
    });
  }, [unidadesMedida]);

  async function loadProductosData() {
    if (!negocio?.id) return;

    try {
      setIsLoading(true);
      setFeedback("");

      const { data, error } = await supabase
        .from("productos")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("nombre", { ascending: true });

      if (error) throw error;

      setProductos(data ?? []);

      setForm((current) => {
        if (current.id || current.codigo) return current;

        return {
          ...current,
          codigo: suggestNextCode(data ?? []),
        };
      });
    } catch (error) {
      console.error("Error cargando productos:", error);
      setFeedback("No se pudieron cargar los productos.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadProductosData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id]);

  const filteredProductos = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    const result = productos.filter((producto) => {
      const text = normalizeText(
        `${producto.codigo || ""} ${producto.nombre || ""} ${
          producto.descripcion || ""
        }`
      );

      const matchesSearch = text.includes(normalizedSearch);

      const matchesActive =
        activeFilter === "todos"
          ? true
          : activeFilter === "activos"
            ? producto.activo
            : !producto.activo;

      const stock = Number(producto.stock_actual || 0);

      const matchesStock =
        stockFilter === "todos"
          ? true
          : stockFilter === "con_stock"
            ? stock > 0
            : stock <= 0;

      const matchesUsage =
        usageFilter === "todos"
          ? true
          : usageFilter === "venta"
            ? producto.disponible_venta
            : usageFilter === "insumo"
              ? producto.disponible_insumo
              : usageFilter === "solo_insumo"
                ? producto.disponible_insumo && !producto.disponible_venta
                : true;

      return matchesSearch && matchesActive && matchesStock && matchesUsage;
    });

    return [...result].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "codigo") {
        return (
          String(a.codigo || "").localeCompare(String(b.codigo || ""), "es", {
            numeric: true,
          }) * direction
        );
      }

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

      if (sortConfig.key === "costo_unitario") {
        return (
          (Number(a.costo_unitario) - Number(b.costo_unitario)) * direction
        );
      }

      if (sortConfig.key === "stock_actual") {
        return (Number(a.stock_actual) - Number(b.stock_actual)) * direction;
      }

      if (sortConfig.key === "activo") {
        return (Number(b.activo) - Number(a.activo)) * direction;
      }

      return 0;
    });
  }, [productos, search, activeFilter, stockFilter, usageFilter, sortConfig]);

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
      [field]:
        field === "nombre" || field === "descripcion"
          ? capitalizeFirstLetter(value)
          : value,
    }));
  }

  function updateNumericFormField(field, value) {
    const integerFields = ["stock_actual", "stock_minimo"];

    setForm((current) => ({
      ...current,
      [field]: integerFields.includes(field)
        ? normalizeIntegerInput(value)
        : normalizeDecimalInput(value),
    }));
  }

  function resetForm() {
    setForm({
      ...emptyProductForm,
      codigo: suggestNextCode(productos),
    });
    setFeedback("");
  }

  function loadProductForEdit(producto) {
    setForm({
      id: producto.id,
      codigo: producto.codigo || "",
      nombre: producto.nombre || "",
      descripcion: producto.descripcion || "",
      precio_lista: numberToInputValue(producto.precio_lista),
      precio_efectivo: numberToInputValue(producto.precio_efectivo),
      costo_unitario: numberToInputValue(producto.costo_unitario),
      stock_actual: numberToInputValue(producto.stock_actual),
      stock_minimo: numberToInputValue(producto.stock_minimo),
      disponible_venta: Boolean(producto.disponible_venta),
      disponible_insumo: Boolean(producto.disponible_insumo),
      unidad_medida: producto.unidad_medida || "unidad",
      cantidad_suelta: numberToInputValue(producto.cantidad_suelta),
      contenido_por_unidad: numberToInputValue(producto.contenido_por_unidad),
      unidad_contenido: producto.unidad_contenido || "unidad",
      dosificacion_default: numberToInputValue(producto.dosificacion_default),
      activo: Boolean(producto.activo),
    });

    setFeedback(`Editando producto: ${producto.nombre}`);
  }

  function findDuplicateCode() {
    const cleanCode = form.codigo.trim();

    if (!cleanCode) return null;

    return productos.find(
      (producto) => producto.codigo === cleanCode && producto.id !== form.id
    );
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!negocio?.id) {
      setFeedback("No se encontró el negocio actual.");
      return;
    }

    if (!form.nombre.trim()) {
      setFeedback("El nombre del producto es obligatorio.");
      return;
    }

    if (!form.disponible_venta && !form.disponible_insumo) {
      setFeedback("El producto debe estar disponible para venta, insumo o ambos.");
      return;
    }

    const duplicateCode = findDuplicateCode();

    if (duplicateCode) {
      const shouldEditExisting = window.confirm(
        `Ya existe un producto con el código "${duplicateCode.codigo}" llamado "${duplicateCode.nombre}". ¿Querés cargarlo para modificarlo?`
      );

      if (shouldEditExisting) {
        loadProductForEdit(duplicateCode);
      }

      return;
    }

    try {
      setIsSaving(true);
      setFeedback("");

      const productPayload = normalizeProductPayload(form, negocio.id);

      if (isEditing) {
        const { error } = await supabase
          .from("productos")
          .update(productPayload)
          .eq("id", form.id)
          .eq("negocio_id", negocio.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("productos").insert(productPayload);

        if (error) throw error;
      }

      setFeedback(
        isEditing
          ? "Producto actualizado correctamente."
          : "Producto creado correctamente."
      );

      resetForm();
      await loadProductosData();
      await refreshAppData();
    } catch (error) {
      console.error("Error guardando producto:", error);

      if (error?.code === "23505") {
        setFeedback("Ya existe un producto con ese código.");
        return;
      }

      setFeedback("No se pudo guardar el producto.");
    } finally {
      setIsSaving(false);
    }
  }

  async function toggleProductActive(producto) {
    if (!negocio?.id) return;

    try {
      const { error } = await supabase
        .from("productos")
        .update({ activo: !producto.activo })
        .eq("id", producto.id)
        .eq("negocio_id", negocio.id);

      if (error) throw error;

      await loadProductosData();
      await refreshAppData();
    } catch (error) {
      console.error("Error cambiando estado del producto:", error);
      setFeedback("No se pudo cambiar el estado del producto.");
    }
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Productos</span>
        <h2>ABM de productos</h2>
        <p>
          Gestioná productos para venta, insumos, stock, costos y precios
          diferenciados por lista o efectivo.
        </p>
      </section>

      <section className="work-card product-form-card">
        <div className="toolbar">
          <div>
            <strong>{isEditing ? "Modificar producto" : "Nuevo producto"}</strong>
            <small>
              El código se sugiere automáticamente desde 1000000, pero podés
              ingresar uno menor o mayor manualmente.
            </small>
          </div>

          <button type="button" className="btn btn-ghost" onClick={resetForm}>
            <FiX />
            Limpiar
          </button>
        </div>

        <form className="product-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>Código</span>
              <input
                type="text"
                value={form.codigo}
                onChange={(event) =>
                  updateFormField("codigo", event.target.value)
                }
                placeholder="Ej: 1000000"
              />
            </label>

            <label className="form-field">
              <span>Nombre del producto</span>
              <input
                list="productos-existentes"
                type="text"
                value={form.nombre}
                onChange={(event) =>
                  updateFormField("nombre", event.target.value)
                }
                placeholder="Ej: Pomada"
                required
              />

              <datalist id="productos-existentes">
                {productos.map((producto) => (
                  <option key={producto.id} value={producto.nombre} />
                ))}
              </datalist>
            </label>

            <label className="form-field">
              <span>Precio de lista</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.precio_lista}
                onChange={(event) =>
                  updateNumericFormField("precio_lista", event.target.value)
                }
                placeholder="0"
              />
            </label>

            <label className="form-field">
              <span>Precio efectivo</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.precio_efectivo}
                onChange={(event) =>
                  updateNumericFormField("precio_efectivo", event.target.value)
                }
                placeholder="0"
              />
            </label>

            <label className="form-field">
              <span>Costo unitario</span>
              <input
                type="text"
                inputMode="decimal"
                value={form.costo_unitario}
                onChange={(event) =>
                  updateNumericFormField("costo_unitario", event.target.value)
                }
                placeholder="0"
              />
            </label>

            <label className="form-field">
              <span>Stock actual</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.stock_actual}
                onChange={(event) =>
                  updateNumericFormField("stock_actual", event.target.value)
                }
                placeholder="0"
              />
            </label>

            <label className="form-field">
              <span>Stock mínimo</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.stock_minimo}
                onChange={(event) =>
                  updateNumericFormField("stock_minimo", event.target.value)
                }
                placeholder="0"
              />
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
              placeholder="Ej: Producto para peinado o uso como insumo."
            />
          </label>

          <div className="product-options-grid">
            <button
              type="button"
              className={`status-switch ${
                form.disponible_venta ? "is-active" : ""
              }`}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  disponible_venta: !current.disponible_venta,
                }))
              }
            >
              {form.disponible_venta
                ? "Disponible para venta"
                : "No disponible para venta"}
            </button>

            <button
              type="button"
              className={`status-switch ${
                form.disponible_insumo ? "is-active" : ""
              }`}
              onClick={() =>
                setForm((current) => ({
                  ...current,
                  disponible_insumo: !current.disponible_insumo,
                }))
              }
            >
              {form.disponible_insumo
                ? "Disponible como insumo"
                : "No disponible como insumo"}
            </button>

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
          </div>

          <div className="costs-box">
            <div>
              <strong>Stock e insumo / dosificación </strong>
              <small>
                El stock actual representa unidades enteras. El contenido por unidad y la dosificación sirven para calcular costos por uso.
              </small>
            </div>

            <div className="form-grid">
              <label className="form-field">
                <span>Unidad de medida</span>
                <input
                  list="unidades-producto"
                  type="text"
                  value={form.unidad_medida}
                  onChange={(event) =>
                    updateFormField("unidad_medida", event.target.value)
                  }
                  placeholder="unidad"
                />
              </label>

              <label className="form-field">
                <span>Cantidad suelta</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.cantidad_suelta}
                    onChange={(event) =>
                    updateNumericFormField(
                      "cantidad_suelta",
                      event.target.value
                    )
                  }
                  placeholder="0"
                />
              </label>

              <label className="form-field">
                <span>Contenido por unidad</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.contenido_por_unidad}
                    onChange={(event) =>
                    updateNumericFormField(
                      "contenido_por_unidad",
                      event.target.value
                    )
                  }
                  placeholder="1"
                />
              </label>

              <label className="form-field">
                <span>Unidad de contenido</span>
                <input
                  list="unidades-producto"
                  type="text"
                  value={form.unidad_contenido}
                  onChange={(event) =>
                    updateFormField("unidad_contenido", event.target.value)
                  }
                  placeholder="unidad"
                />
              </label>

              <label className="form-field">
                <span>Dosificación sugerida</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.dosificacion_default}
                    onChange={(event) =>
                    updateNumericFormField(
                      "dosificacion_default",
                      event.target.value
                    )
                  }
                  placeholder="0"
                />
              </label>
            </div>

            <datalist id="unidades-producto">
              {unidadesSugeridas.map((unidad) => (
                <option
                  key={unidad.codigo}
                  value={unidad.codigo}
                  label={unidad.nombre}
                />
              ))}
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
                  ? "Actualizar producto"
                  : "Crear producto"}
            </button>
          </div>
        </form>
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>Productos cargados</strong>
            <small>
              Lista ordenada alfabéticamente por defecto, con filtros de estado,
              stock y uso.
            </small>
          </div>

          <div className="toolbar-actions">
            <label className="search-box">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar producto..."
              />
            </label>

            <select
              className="toolbar-select"
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value)}
            >
              <option value="activos">Activos</option>
              <option value="inactivos">Inactivos</option>
              <option value="todos">Todos</option>
            </select>

            <select
              className="toolbar-select"
              value={stockFilter}
              onChange={(event) => setStockFilter(event.target.value)}
            >
              <option value="todos">Con y sin stock</option>
              <option value="con_stock">Con stock</option>
              <option value="sin_stock">Sin stock</option>
            </select>

            <select
              className="toolbar-select"
              value={usageFilter}
              onChange={(event) => setUsageFilter(event.target.value)}
            >
              <option value="todos">Venta e insumo</option>
              <option value="venta">Para venta</option>
              <option value="insumo">Como insumo</option>
              <option value="solo_insumo">Solo insumo</option>
            </select>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={loadProductosData}
            >
              <FiRefreshCw />
              Actualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="empty-state">Cargando productos...</p>
        ) : filteredProductos.length === 0 ? (
          <p className="empty-state">No hay productos para mostrar.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => updateSort("codigo")}>
                      Código <SortIcon columnKey="codigo" />
                    </button>
                  </th>

                  <th>
                    <button type="button" onClick={() => updateSort("nombre")}>
                      Producto <SortIcon columnKey="nombre" />
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
                      onClick={() => updateSort("costo_unitario")}
                    >
                      Costo <SortIcon columnKey="costo_unitario" />
                    </button>
                  </th>

                  <th>
                    <button
                      type="button"
                      onClick={() => updateSort("stock_actual")}
                    >
                      Stock <SortIcon columnKey="stock_actual" />
                    </button>
                  </th>

                  <th>Uso</th>

                  <th>
                    <button type="button" onClick={() => updateSort("activo")}>
                      Estado <SortIcon columnKey="activo" />
                    </button>
                  </th>

                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredProductos.map((producto) => {
                  const isLowStock =
                    Number(producto.stock_actual || 0) <=
                    Number(producto.stock_minimo || 0);

                  return (
                    <tr key={producto.id}>
                      <td>
                        <strong>{producto.codigo || "Sin código"}</strong>
                      </td>

                      <td>
                        <strong>{producto.nombre}</strong>
                        <small>{producto.descripcion || "Sin descripción"}</small>
                      </td>

                      <td>{formatCurrency(producto.precio_lista)}</td>
                      <td>{formatCurrency(producto.precio_efectivo)}</td>
                      <td>{formatCurrency(producto.costo_unitario)}</td>

                      <td>
                        <strong>
                          {formatNumber(producto.stock_actual)}{" "}
                          {producto.unidad_medida || "unidad"}
                        </strong>
                        <small>
                          Mínimo: {formatNumber(producto.stock_minimo)}
                          {isLowStock ? " · Reponer" : ""}
                        </small>
                      </td>

                      <td>
                        <div className="usage-pills">
                          {producto.disponible_venta && (
                            <span className="status-pill is-active">Venta</span>
                          )}

                          {producto.disponible_insumo && (
                            <span className="status-pill is-warning">
                              Insumo
                            </span>
                          )}
                        </div>
                      </td>

                      <td>
                        <span
                          className={`status-pill ${
                            producto.activo ? "is-active" : "is-inactive"
                          }`}
                        >
                          {producto.activo ? "Activo" : "Inactivo"}
                        </span>
                      </td>

                      <td>
                        <div className="table-actions">
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => loadProductForEdit(producto)}
                            aria-label="Editar producto"
                          >
                            <FiEdit2 />
                          </button>

                          <button
                            type="button"
                            className="btn btn-ghost btn-small"
                            onClick={() => toggleProductActive(producto)}
                          >
                            {producto.activo ? "Desactivar" : "Activar"}
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