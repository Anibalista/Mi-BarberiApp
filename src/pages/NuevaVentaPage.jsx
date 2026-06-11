import { useMemo, useState } from "react";
import { FiPhone, FiSave, FiShoppingCart, FiTrash2, FiSearch, FiUserPlus } from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../lib/supabaseClient";
import {
  capitalizeFirstLetter,
  normalizeText,
  preventInvalidNumberKeys,
} from "../utils/formGuards";
import { formatCurrency } from "../utils/formatters";

const emptyPhoneForm = {
  paisTelefono: "+54",
  areaTelefono: "",
  numeroTelefono: "",
};

const countryCodes = [
  { codigo: "+54", nombre: "Argentina" },
  { codigo: "+598", nombre: "Uruguay" },
];

function createTempId() {
  return crypto.randomUUID();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeDecimalInput(value) {
  const cleanValue = String(value || "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "");

  const parts = cleanValue.split(".");

  if (parts.length > 2) {
    return `${parts[0]}.${parts.slice(1).join("")}`;
  }

  return cleanValue;
}

function normalizeIntegerInput(value) {
  return onlyDigits(value);
}

function numberFromInput(value) {
  return Number(String(value || "0").replace(",", "."));
}

function capitalizeWordsInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function normalizeClientNameForSave(value) {
  return capitalizeWordsInput(String(value || "").trim().replace(/\s+/g, " "));
}


function getClientFullName(cliente) {
  return `${cliente?.nombre || ""} ${cliente?.apellido || ""}`.trim() || "Cliente sin nombre";
}

function getClientPhoneLabel(cliente) {
  return cliente?.telefono || cliente?.whatsapp || "Sin teléfono";
}

function buildPhone({ paisTelefono, areaTelefono, numeroTelefono }) {
  const countryCode = String(paisTelefono || "+54").replace(/\D/g, "");
  let area = onlyDigits(areaTelefono);
  const number = onlyDigits(numeroTelefono);

  const hasAnyPhoneData = Boolean(area || number);

  if (!hasAnyPhoneData) {
    return {
      value: null,
      label: "Sin teléfono",
      error: "",
    };
  }

  if (!number) {
    return {
      value: null,
      label: "",
      error: "Si querés cargar teléfono, ingresá el número.",
    };
  }

  if (number.startsWith("15")) {
    return {
      value: null,
      label: "",
      error:
        "El número no puede iniciar con 15. Cargá el número sin el prefijo 15.",
    };
  }

  if (!area && paisTelefono === "+54") {
    if (number.length === 6) {
      area = "3446";
    } else if (number.length === 8) {
      area = "11";
    }
  }

  if (!area && paisTelefono !== "+598") {
    return {
      value: null,
      label: "",
      error:
        "Ingresá código de área o usá un número de 6 dígitos para asumir 3446 o de 8 dígitos para asumir 11.",
    };
  }

  const label = area
    ? `+${countryCode}-${area}-${number}`
    : `+${countryCode}-${number}`;

  return {
    value: label,
    label,
    error: "",
  };
}

function getItemPrice(item, tipoPrecio) {
  return tipoPrecio === "efectivo"
    ? Number(item.precio_efectivo || 0)
    : Number(item.precio_lista || 0);
}

function calculateSubtotal(cantidad, precio) {
  return numberFromInput(cantidad) * numberFromInput(precio);
}

function isCashPayment(medioPago) {
  if (!medioPago) return false;

  return (
    normalizeText(medioPago.tipo) === "efectivo" ||
    normalizeText(medioPago.nombre).includes("efectivo")
  );
}

export default function NuevaVentaPage() {
  const {
    negocio,
    sucursal,
    productos,
    clientes,
    mediosPago,
    refreshAppData,
  } = useAppData();

  const productosVenta = useMemo(
    () =>
      productos
        .filter((producto) => producto.activo && producto.disponible_venta)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [productos]
  );

  const clientesOrdenados = useMemo(
    () =>
      [...clientes].sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
      ),
    [clientes]
  );


  const [clienteMode, setClienteMode] = useState("existente");
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [showClientPhone, setShowClientPhone] = useState(false);
  const [phoneForm, setPhoneForm] = useState(emptyPhoneForm);

  const [medioPagoId, setMedioPagoId] = useState("");
  const [tipoPrecio, setTipoPrecio] = useState("lista");
  const [productoBusqueda, setProductoBusqueda] = useState("");
  const [observaciones, setObservaciones] = useState("");

  const [productosSeleccionados, setProductosSeleccionados] = useState([]);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const phonePreview = useMemo(() => buildPhone(phoneForm), [phoneForm]);

  const selectedCliente = useMemo(
    () => clientesOrdenados.find((cliente) => cliente.id === selectedClienteId),
    [clientesOrdenados, selectedClienteId]
  );

  const clientesFiltrados = useMemo(() => {
    const normalizedSearch = normalizeText(clienteSearch);

    if (!normalizedSearch) {
      return clientesOrdenados.slice(0, 8);
    }

    return clientesOrdenados
      .filter((cliente) =>
        normalizeText(
          `${getClientFullName(cliente)} ${getClientPhoneLabel(cliente)}`
        ).includes(normalizedSearch)
      )
      .slice(0, 12);
  }, [clientesOrdenados, clienteSearch]);


  const total = useMemo(
    () =>
      productosSeleccionados.reduce(
        (acc, item) => acc + Number(item.subtotal || 0),
        0
      ),
    [productosSeleccionados]
  );

  function resetForm() {
    setClienteMode("existente");
    setSelectedClienteId("");
    setClienteSearch("");
    setClienteNombre("");
    setShowClientPhone(false);
    setPhoneForm(emptyPhoneForm);
    setMedioPagoId("");
    setTipoPrecio("lista");
    setProductoBusqueda("");
    setObservaciones("");
    setProductosSeleccionados([]);
    setFeedback("");
  }

  function updatePhoneField(field, value) {
    setPhoneForm((current) => ({
      ...current,
      [field]:
        field === "paisTelefono"
          ? value
          : onlyDigits(value).slice(0, field === "areaTelefono" ? 6 : 10),
    }));
  }

  function updateSuggestedPrices(nextTipoPrecio) {
    setProductosSeleccionados((current) =>
      current.map((item) => {
        if (item.precio_manual) return item;

        const nextPrice =
          nextTipoPrecio === "efectivo"
            ? Number(item.precio_efectivo || 0)
            : Number(item.precio_lista || 0);

        return {
          ...item,
          precio_cobrado: String(nextPrice),
          subtotal: calculateSubtotal(item.cantidad, nextPrice),
        };
      })
    );
  }

  function handleMedioPagoChange(nextMedioPagoId) {
    setMedioPagoId(nextMedioPagoId);

    const selectedMedioPago = mediosPago.find(
      (medio) => medio.id === nextMedioPagoId
    );

    const nextTipoPrecio = isCashPayment(selectedMedioPago)
      ? "efectivo"
      : "lista";

    setTipoPrecio(nextTipoPrecio);
    updateSuggestedPrices(nextTipoPrecio);
  }

  function handleTipoPrecioChange(nextTipoPrecio) {
    setTipoPrecio(nextTipoPrecio);
    updateSuggestedPrices(nextTipoPrecio);
  }

  function findProductByName(productName) {
    const normalizedProductName = normalizeText(productName);

    return productosVenta.find(
      (producto) => normalizeText(producto.nombre) === normalizedProductName
    );
  }

  function addProducto(producto) {
    if (!producto) return;

    const precio = getItemPrice(producto, tipoPrecio);

    setProductosSeleccionados((current) => [
      ...current,
      {
        tempId: createTempId(),
        id: producto.id,
        nombre: producto.nombre,
        precio_lista: Number(producto.precio_lista || 0),
        precio_efectivo: Number(producto.precio_efectivo || 0),
        precio_cobrado: String(precio),
        precio_manual: false,
        costo_unitario: Number(producto.costo_unitario || 0),
        cantidad: "1",
        stock_actual: Number(producto.stock_actual || 0),
        subtotal: precio,
      },
    ]);

    setProductoBusqueda("");
  }

  function handleAddProductFromInput() {
    const producto = findProductByName(productoBusqueda);

    if (!producto) {
      setFeedback("Seleccioná un producto válido desde el autocompletar.");
      return;
    }

    addProducto(producto);
    setFeedback("");
  }

  function removeProducto(tempId) {
    setProductosSeleccionados((current) =>
      current.filter((item) => item.tempId !== tempId)
    );
  }

  function updateProductoCantidad(tempId, value) {
    const cleanValue = normalizeIntegerInput(value);

    setProductosSeleccionados((current) =>
      current.map((item) => {
        if (item.tempId !== tempId) return item;

        return {
          ...item,
          cantidad: cleanValue,
          subtotal: calculateSubtotal(cleanValue, item.precio_cobrado),
        };
      })
    );
  }

  function updateProductoPrecio(tempId, value) {
    const cleanValue = normalizeDecimalInput(value);

    setProductosSeleccionados((current) =>
      current.map((item) => {
        if (item.tempId !== tempId) return item;

        return {
          ...item,
          precio_cobrado: cleanValue,
          precio_manual: true,
          subtotal: calculateSubtotal(item.cantidad, cleanValue),
        };
      })
    );
  }

  async function getOrCreateClient(phoneResult) {
    if (clienteMode === "existente") {
      const existingClient = clientesOrdenados.find(
        (cliente) => cliente.id === selectedClienteId
      );

      if (!existingClient) {
        throw new Error("Cliente seleccionado no encontrado.");
      }

      const existingPhone = existingClient.telefono || existingClient.whatsapp;

      if (phoneResult.value && !existingPhone) {
        const { data, error } = await supabase
          .from("clientes")
          .update({
            telefono: phoneResult.value,
            whatsapp: phoneResult.value,
          })
          .eq("id", existingClient.id)
          .eq("negocio_id", negocio.id)
          .select("*")
          .single();

        if (error) throw error;

        return data;
      }

      return existingClient;
    }

    const cleanName = String(clienteNombre || "").trim().replace(/\s+/g, " ");
    const normalizedName = normalizeClientNameForSave(cleanName);

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        negocio_id: negocio.id,
        nombre: normalizedName,
        telefono: phoneResult.value,
        whatsapp: phoneResult.value,
        origen: "venta_rapida",
      })
      .select("*")
      .single();

    if (error) throw error;

    return data;
  }

  function getStockWarnings() {
    return productosSeleccionados
      .filter((item) => numberFromInput(item.cantidad) > Number(item.stock_actual || 0))
      .map(
        (item) =>
          `La venta de "${item.nombre}" supera el stock actual. Stock actual: ${item.stock_actual}. Cantidad a vender: ${numberFromInput(
            item.cantidad
          )}. Si confirmás, el stock quedará negativo para corregirlo luego en inventario.`
      );
  }

  function validateBeforeSave(phoneResult) {
    if (!negocio?.id) {
      return "No se encontró el negocio actual.";
    }

    if (!sucursal?.id) {
      return "No se encontró la sucursal actual.";
    }

    if (clienteMode === "existente" && !selectedClienteId) {
      return "Seleccioná un cliente registrado o usá Nuevo cliente.";
    }

    if (clienteMode === "nuevo" && !clienteNombre.trim()) {
      return "Ingresá el nombre del cliente nuevo.";
    }

    if (phoneResult.error) {
      return phoneResult.error;
    }

    if (productosSeleccionados.length === 0) {
      return "Agregá al menos un producto.";
    }

    if (!medioPagoId) {
      return "Seleccioná un medio de pago.";
    }

    if (total <= 0) {
      return "El total debe ser mayor a cero.";
    }

    const invalidProducto = productosSeleccionados.find(
      (item) =>
        numberFromInput(item.cantidad) <= 0 ||
        numberFromInput(item.precio_cobrado) <= 0
    );

    if (invalidProducto) {
      return `Revisá cantidad y precio cobrado del producto "${invalidProducto.nombre}". Ambos deben ser mayores a cero.`;
    }

    return "";
  }

  async function discountProductStock() {
    for (const item of productosSeleccionados) {
      const newStock =
        Number(item.stock_actual || 0) - numberFromInput(item.cantidad);

      const { error } = await supabase
        .from("productos")
        .update({
          stock_actual: newStock,
        })
        .eq("id", item.id)
        .eq("negocio_id", negocio.id);

      if (error) throw error;
    }
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const phoneResult = buildPhone(phoneForm);
    const validationError = validateBeforeSave(phoneResult);

    if (validationError) {
      setFeedback(validationError);
      return;
    }

    const stockWarnings = getStockWarnings();
    const stockWarningText = stockWarnings.length
      ? `\n\n⚠️ ADVERTENCIA DE STOCK:\n- ${stockWarnings.join("\n- ")}`
      : "";

    const shouldSave = window.confirm(
      `Vas a registrar una venta de productos por ${formatCurrency(
        total
      )}. Esta operación no se podrá editar directamente después.${stockWarningText}\n\n¿Confirmás el registro?`
    );

    if (!shouldSave) {
      setFeedback("Registro cancelado.");
      return;
    }

    try {
      setIsSaving(true);
      setFeedback("");

      const cliente = await getOrCreateClient(phoneResult);

      const { data: atencion, error: atencionError } = await supabase
        .from("atenciones")
        .insert({
          negocio_id: negocio.id,
          sucursal_id: sucursal.id,
          cliente_id: cliente.id,
          nombre_cliente_temporal: null,
          colaborador_id: null,
          tipo_atencion: "directa",
          estado: "cobrada",
          total_servicios: 0,
          total_productos: total,
          descuento: 0,
          total_final: total,
          observaciones: observaciones.trim() || "Venta de productos",
        })
        .select("*")
        .single();

      if (atencionError) throw atencionError;

      const productosPayload = productosSeleccionados.map((item) => ({
        atencion_id: atencion.id,
        producto_id: item.id,
        nombre_producto_snapshot: item.nombre,
        cantidad: numberFromInput(item.cantidad),
        precio_lista: item.precio_lista,
        precio_efectivo: item.precio_efectivo,
        precio_cobrado: numberFromInput(item.precio_cobrado),
        costo_unitario: item.costo_unitario,
        subtotal: Number(item.subtotal || 0),
      }));

      const { error: productosError } = await supabase
        .from("atencion_productos")
        .insert(productosPayload);

      if (productosError) throw productosError;

      await discountProductStock();

      const { error: pagoError } = await supabase.from("pagos").insert({
        negocio_id: negocio.id,
        sucursal_id: sucursal.id,
        atencion_id: atencion.id,
        caja_id: null,
        cliente_id: cliente.id,
        monto: total,
        medio_pago_id: medioPagoId,
        estado: "registrado",
      });

      if (pagoError) throw pagoError;

      setFeedback("Venta registrada correctamente.");
      resetForm();
      await refreshAppData();
    } catch (error) {
      console.error("Error registrando venta:", error);
      setFeedback("No se pudo registrar la venta.");
    } finally {
      setIsSaving(false);
    }
  }

  const currentStockWarnings = getStockWarnings();

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Venta de productos</span>
        <h2>Nueva venta</h2>
        <p>
          Registrá ventas de productos sin agregar servicios. El sistema descuenta
          stock y guarda el cobro asociado.
        </p>
      </section>

      <form className="work-card" onSubmit={handleSubmit}>
        <div className="form-grid">
          <div className="client-picker-compact">
            <div className="client-picker-compact__header">
              <div>
                <strong>Cliente</strong>
                <small>
                  {clienteMode === "existente"
                    ? "Buscá por nombre o teléfono y seleccioná el cliente correcto."
                    : "Cargá un cliente nuevo sin vincularlo a uno existente."}
                </small>
              </div>

              <button
                type="button"
                className="client-mode-button"
                title={
                  clienteMode === "existente"
                    ? "Registrar cliente nuevo"
                    : "Buscar cliente existente"
                }
                aria-label={
                  clienteMode === "existente"
                    ? "Registrar cliente nuevo"
                    : "Buscar cliente existente"
                }
                onClick={() => {
                  const nextMode = clienteMode === "existente" ? "nuevo" : "existente";

                  setClienteMode(nextMode);
                  setSelectedClienteId("");
                  setClienteSearch("");
                  setClienteNombre("");
                }}
              >
                {clienteMode === "existente" ? <FiUserPlus /> : <FiSearch />}
              </button>
            </div>

            {clienteMode === "existente" ? (
              <div className="client-search-box">
                <label className="form-field">
                  <span>Buscar cliente</span>
                  <input
                    type="search"
                    value={clienteSearch}
                    onChange={(event) => {
                      setClienteSearch(event.target.value);
                      setSelectedClienteId("");
                    }}
                    placeholder="Nombre, apellido o teléfono..."
                  />
                </label>

                <div className="client-search-results">
                  {clientesFiltrados.length === 0 ? (
                    <p className="client-picker-hint">No encontré clientes con esa búsqueda.</p>
                  ) : (
                    clientesFiltrados.map((cliente) => (
                      <button
                        key={cliente.id}
                        type="button"
                        className={`client-result-button ${
                          selectedClienteId === cliente.id ? "is-selected" : ""
                        }`}
                        onClick={() => {
                          setSelectedClienteId(cliente.id);
                          setClienteSearch(getClientFullName(cliente));
                        }}
                      >
                        <strong>{getClientFullName(cliente)}</strong>
                        <small>{getClientPhoneLabel(cliente)}</small>
                      </button>
                    ))
                  )}
                </div>

                {selectedCliente && (
                  <p className="phone-preview">
                    Cliente seleccionado: <strong>{getClientFullName(selectedCliente)}</strong> ·{" "}
                    {getClientPhoneLabel(selectedCliente)}
                  </p>
                )}
              </div>
            ) : (
              <label className="form-field">
                <span>Nombre del cliente nuevo</span>
                <input
                  type="text"
                  value={clienteNombre}
                  onChange={(event) =>
                    setClienteNombre(capitalizeWordsInput(event.target.value))
                  }
                  placeholder="Ej: Cliente de paso"
                  required
                />
              </label>
            )}
          </div>
          <label className="form-field">
            <span>Medio de pago</span>
            <select
              value={medioPagoId}
              onChange={(event) => handleMedioPagoChange(event.target.value)}
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
              onChange={(event) => handleTipoPrecioChange(event.target.value)}
            >
              <option value="lista">Precio de lista</option>
              <option value="efectivo">Precio efectivo</option>
            </select>
          </label>
        </div>

        <button
          type="button"
          className={`status-switch ${showClientPhone ? "is-active" : ""}`}
          onClick={() => setShowClientPhone((current) => !current)}
        >
          <FiPhone />
          {showClientPhone ? "Ocultar teléfono del cliente" : "Agregar teléfono"}
        </button>

        {showClientPhone && (
          <div className="phone-box">
            <div>
              <strong>Teléfono / WhatsApp</strong>
              <small>
                Opcional. Si el cliente no existe se guarda con el alta rápida.
                Si existe y no tiene teléfono, se completa.
              </small>
            </div>

            <div className="phone-grid">
              <label className="form-field">
                <span>País</span>
                <select
                  value={phoneForm.paisTelefono}
                  onChange={(event) =>
                    updatePhoneField("paisTelefono", event.target.value)
                  }
                >
                  {countryCodes.map((country) => (
                    <option key={country.codigo} value={country.codigo}>
                      {country.nombre} {country.codigo}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Área</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={phoneForm.areaTelefono}
                  onKeyDown={preventInvalidNumberKeys}
                  onChange={(event) =>
                    updatePhoneField("areaTelefono", event.target.value)
                  }
                  placeholder="Ej: 3446"
                />
              </label>

              <label className="form-field">
                <span>Número</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={phoneForm.numeroTelefono}
                  onKeyDown={preventInvalidNumberKeys}
                  onChange={(event) =>
                    updatePhoneField("numeroTelefono", event.target.value)
                  }
                  placeholder="Ej: 646464"
                />
              </label>
            </div>

            <p className="phone-preview">
              Teléfono completo: <strong>{phonePreview.label}</strong>
            </p>
          </div>
        )}

        <section className="work-card product-sale-picker">
          <div className="toolbar">
            <div>
              <strong>Agregar producto</strong>
              <small>
                Usá autocompletar para elegir productos disponibles para venta.
              </small>
            </div>
          </div>

          <div className="sale-picker-grid">
            <label className="form-field">
              <span>Producto</span>
              <input
                list="productos-venta"
                type="text"
                value={productoBusqueda}
                onChange={(event) =>
                  setProductoBusqueda(capitalizeFirstLetter(event.target.value))
                }
                placeholder="Buscar producto..."
              />

              <datalist id="productos-venta">
                {productosVenta.map((producto) => (
                  <option key={producto.id} value={producto.nombre} />
                ))}
              </datalist>
            </label>

            <div className="form-field form-field--checkbox">
              <span>Acción</span>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleAddProductFromInput}
              >
                <FiShoppingCart />
                Agregar producto
              </button>
            </div>
          </div>
        </section>

        <section className="items-list">
          <h3 className="inline-section-title">Productos vendidos</h3>

          {productosSeleccionados.length === 0 ? (
            <p className="empty-state">Todavía no agregaste productos.</p>
          ) : (
            productosSeleccionados.map((producto) => (
              <article key={producto.tempId} className="line-item">
                <div>
                  <strong>{producto.nombre}</strong>
                  <small>
                    Lista: {formatCurrency(producto.precio_lista)} · Efectivo:{" "}
                    {formatCurrency(producto.precio_efectivo)} · Stock:{" "}
                    {producto.stock_actual}
                    {producto.precio_manual ? " · Precio manual" : ""}
                  </small>
                </div>

                <label className="mini-field">
                  <span>Cantidad</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={producto.cantidad}
                    onKeyDown={preventInvalidNumberKeys}
                    onChange={(event) =>
                      updateProductoCantidad(producto.tempId, event.target.value)
                    }
                  />
                </label>

                <label className="mini-field">
                  <span>Precio cobrado</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={producto.precio_cobrado}
                    onKeyDown={preventInvalidNumberKeys}
                    onChange={(event) =>
                      updateProductoPrecio(producto.tempId, event.target.value)
                    }
                  />
                </label>

                <span>{formatCurrency(producto.subtotal)}</span>

                <button
                  type="button"
                  className="icon-button"
                  onClick={() => removeProducto(producto.tempId)}
                  aria-label="Quitar producto"
                >
                  <FiTrash2 />
                </button>
              </article>
            ))
          )}
        </section>

        <label className="form-field">
          <span>Observaciones</span>
          <textarea
            rows="3"
            value={observaciones}
            onChange={(event) =>
              setObservaciones(capitalizeFirstLetter(event.target.value))
            }
            placeholder="Opcional"
          />
        </label>

        {currentStockWarnings.length > 0 && (
          <div className="stock-warning-box">
            <strong>Advertencia de stock</strong>
            <ul>
              {currentStockWarnings.map((warning) => (
                <li key={warning}>{warning}</li>
              ))}
            </ul>
            <small>
              Podés guardar igual si el stock cargado estaba desactualizado. El
              stock quedará negativo para revisar inventario luego.
            </small>
          </div>
        )}

        <div className="total-bar">
          <span>Total venta</span>
          <strong>{formatCurrency(total)}</strong>
        </div>

        {feedback && <p className="form-feedback">{feedback}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={resetForm}>
            <FiShoppingCart />
            Limpiar
          </button>

          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            <FiSave />
            {isSaving ? "Guardando..." : "Guardar venta"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}