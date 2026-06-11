import { useEffect, useMemo, useState } from "react";
import { FiPhone, FiSave, FiScissors, FiTrash2, FiSearch, FiUserPlus } from "react-icons/fi";
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

function roundTo(value, decimals = 6) {
  const multiplier = 10 ** decimals;

  return Math.round(Number(value || 0) * multiplier) / multiplier;
}

function capitalizeWordsInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
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

function calculateProductStockAfterInsumoConsumption(producto, cantidadConsumida) {
  const contenidoPorUnidad = Number(producto.contenido_por_unidad || 1) || 1;
  const stockActual = Number(producto.stock_actual || 0);
  const cantidadSuelta = Number(producto.cantidad_suelta || 0);

  const totalDisponibleEnContenido =
    stockActual * contenidoPorUnidad + cantidadSuelta;

  const nuevoTotalEnContenido =
    totalDisponibleEnContenido - Number(cantidadConsumida || 0);

  const nuevoStockEntero = Math.floor(
    nuevoTotalEnContenido / contenidoPorUnidad
  );

  const nuevaCantidadSuelta = roundTo(
    nuevoTotalEnContenido - nuevoStockEntero * contenidoPorUnidad,
    3
  );

  return {
    stock_actual: nuevoStockEntero,
    cantidad_suelta: nuevaCantidadSuelta,
  };
}

export default function AtencionRapidaPage() {
  const {
    negocio,
    sucursal,
    colaborador,
    servicios,
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


  const [servicioCostos, setServicioCostos] = useState([]);

  const [clienteMode, setClienteMode] = useState("existente");
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [showClientPhone, setShowClientPhone] = useState(false);
  const [phoneForm, setPhoneForm] = useState(emptyPhoneForm);

  const [medioPagoId, setMedioPagoId] = useState("");
  const [tipoPrecio, setTipoPrecio] = useState("lista");
  const [observaciones, setObservaciones] = useState("");

  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);
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


  const totalServicios = useMemo(
    () =>
      serviciosSeleccionados.reduce(
        (acc, item) => acc + Number(item.subtotal || 0),
        0
      ),
    [serviciosSeleccionados]
  );

  const totalProductos = useMemo(
    () =>
      productosSeleccionados.reduce(
        (acc, item) => acc + Number(item.subtotal || 0),
        0
      ),
    [productosSeleccionados]
  );

  const total = totalServicios + totalProductos;

  useEffect(() => {
    async function loadServicioCostos() {
      if (!negocio?.id) return;

      const { data, error } = await supabase
        .from("servicio_costos")
        .select("*")
        .eq("negocio_id", negocio.id)
        .eq("activo", true);

      if (error) {
        console.error("Error cargando costos de servicios:", error);
        setFeedback("No se pudieron cargar los costos de servicios.");
        return;
      }

      setServicioCostos(data ?? []);
    }

    loadServicioCostos();
  }, [negocio?.id]);

  function resetForm() {
    setClienteMode("existente");
    setSelectedClienteId("");
    setClienteSearch("");
    setClienteNombre("");
    setShowClientPhone(false);
    setPhoneForm(emptyPhoneForm);
    setMedioPagoId("");
    setTipoPrecio("lista");
    setObservaciones("");
    setServiciosSeleccionados([]);
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
    setServiciosSeleccionados((current) =>
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

  function addServicio(servicioId) {
    if (!servicioId) return;

    const servicio = servicios.find((item) => item.id === servicioId);
    if (!servicio) return;

    const precio = getItemPrice(servicio, tipoPrecio);
    const precioInput = String(precio);

    setServiciosSeleccionados((current) => [
      ...current,
      {
        tempId: createTempId(),
        id: servicio.id,
        nombre: servicio.nombre,
        precio_lista: Number(servicio.precio_lista || 0),
        precio_efectivo: Number(servicio.precio_efectivo || 0),
        precio_cobrado: precioInput,
        precio_manual: false,
        cantidad: "1",
        subtotal: precio,
      },
    ]);
  }

  function addProducto(productoId) {
    if (!productoId) return;

    const producto = productosVenta.find((item) => item.id === productoId);
    if (!producto) return;

    const precio = getItemPrice(producto, tipoPrecio);
    const precioInput = String(precio);

    setProductosSeleccionados((current) => [
      ...current,
      {
        tempId: createTempId(),
        id: producto.id,
        nombre: producto.nombre,
        precio_lista: Number(producto.precio_lista || 0),
        precio_efectivo: Number(producto.precio_efectivo || 0),
        precio_cobrado: precioInput,
        precio_manual: false,
        costo_unitario: Number(producto.costo_unitario || 0),
        cantidad: "1",
        stock_actual: Number(producto.stock_actual || 0),
        subtotal: precio,
      },
    ]);
  }

  function removeServicio(tempId) {
    setServiciosSeleccionados((current) =>
      current.filter((item) => item.tempId !== tempId)
    );
  }

  function removeProducto(tempId) {
    setProductosSeleccionados((current) =>
      current.filter((item) => item.tempId !== tempId)
    );
  }

  function updateServicioCantidad(tempId, value) {
    const cleanValue = normalizeDecimalInput(value);

    setServiciosSeleccionados((current) =>
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

  function updateServicioPrecio(tempId, value) {
    const cleanValue = normalizeDecimalInput(value);

    setServiciosSeleccionados((current) =>
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
    const normalizedName = capitalizeWordsInput(cleanName);

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        negocio_id: negocio.id,
        nombre: normalizedName,
        telefono: phoneResult.value,
        whatsapp: phoneResult.value,
        origen: "atencion_rapida",
      })
      .select("*")
      .single();

    if (error) throw error;

    return data;
  }

  function getSelectedServiceCosts() {
    return serviciosSeleccionados.flatMap((servicioSeleccionado) => {
      const serviceQuantity = numberFromInput(servicioSeleccionado.cantidad);

      return servicioCostos
        .filter((cost) => cost.servicio_id === servicioSeleccionado.id)
        .map((cost) => {
          const cantidadBase = Number(cost.cantidad || 0);
          const costoUnitario = Number(cost.costo_unitario || 0);
          const cantidadTotal = roundTo(cantidadBase * serviceQuantity, 3);
          const costoTotal = roundTo(costoUnitario * cantidadTotal, 2);

          return {
            ...cost,
            servicio_atencion_nombre: servicioSeleccionado.nombre,
            cantidad_total_atencion: cantidadTotal,
            costo_total_atencion: costoTotal,
          };
        });
    });
  }

  function getInsumoConsumptionsByProduct(selectedCosts) {
    const consumptions = new Map();

    selectedCosts
      .filter((cost) => cost.origen === "producto" && cost.producto_id)
      .forEach((cost) => {
        const current = consumptions.get(cost.producto_id) || 0;

        consumptions.set(
          cost.producto_id,
          roundTo(current + Number(cost.cantidad_total_atencion || 0), 3)
        );
      });

    return consumptions;
  }

  function getInsumoStockWarnings(selectedCosts) {
    const warnings = [];
    const consumptions = getInsumoConsumptionsByProduct(selectedCosts);

    for (const [productoId, cantidadConsumida] of consumptions.entries()) {
      const producto = productos.find((item) => item.id === productoId);

      if (!producto) {
        warnings.push(
          "Uno de los insumos del servicio ya no existe como producto."
        );
        continue;
      }

      const contenidoPorUnidad = Number(producto.contenido_por_unidad || 1) || 1;
      const stockActual = Number(producto.stock_actual || 0);
      const cantidadSuelta = Number(producto.cantidad_suelta || 0);
      const totalDisponible = stockActual * contenidoPorUnidad + cantidadSuelta;

      if (cantidadConsumida > totalDisponible) {
        warnings.push(
          `El servicio consumirá más insumo de "${producto.nombre}" del disponible. Disponible: ${roundTo(
            totalDisponible,
            3
          )} ${
            producto.unidad_contenido || producto.unidad_medida || "unidad"
          }. Necesario: ${cantidadConsumida}. Si confirmás, el stock quedará negativo para corregirlo luego en inventario.`
        );
      }
    }

    return warnings;
  }

  function getProductSaleStockWarnings() {
    return productosSeleccionados
      .filter((item) => numberFromInput(item.cantidad) > Number(item.stock_actual || 0))
      .map(
        (item) =>
          `La venta de "${item.nombre}" supera el stock actual. Stock actual: ${item.stock_actual}. Cantidad a vender: ${numberFromInput(
            item.cantidad
          )}. Si confirmás, el stock quedará negativo para corregirlo luego en inventario.`
      );
  }

  function getStockWarnings() {
    return [
      ...getProductSaleStockWarnings(),
      ...getInsumoStockWarnings(getSelectedServiceCosts()),
    ];
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

    if (serviciosSeleccionados.length === 0 && productosSeleccionados.length === 0) {
      return "Agregá al menos un servicio o producto.";
    }

    if (!medioPagoId) {
      return "Seleccioná un medio de pago.";
    }

    if (total <= 0) {
      return "El total debe ser mayor a cero.";
    }

    const invalidServicio = serviciosSeleccionados.find(
      (item) =>
        numberFromInput(item.cantidad) <= 0 ||
        numberFromInput(item.precio_cobrado) <= 0
    );

    if (invalidServicio) {
      return `Revisá cantidad y precio cobrado del servicio "${invalidServicio.nombre}". Ambos deben ser mayores a cero.`;
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

  async function insertAtencionCostosAndDiscountInsumos(atencionId) {
    const selectedCosts = getSelectedServiceCosts();

    if (selectedCosts.length === 0) return;

    const atencionCostosPayload = selectedCosts.map((cost) => ({
      negocio_id: negocio.id,
      atencion_id: atencionId,
      servicio_id: cost.servicio_id,
      producto_id: cost.origen === "producto" ? cost.producto_id : null,
      origen: cost.origen,
      descripcion: cost.descripcion,
      cantidad: Number(cost.cantidad_total_atencion || 0),
      unidad_medida: cost.unidad_medida || "unidad",
      costo_unitario: Number(cost.costo_unitario || 0),
      costo_total: Number(cost.costo_total_atencion || 0),
    }));

    const { error: costosError } = await supabase
      .from("atencion_costos")
      .insert(atencionCostosPayload);

    if (costosError) throw costosError;

    const consumptions = getInsumoConsumptionsByProduct(selectedCosts);

    for (const [productoId, cantidadConsumida] of consumptions.entries()) {
      const producto = productos.find((item) => item.id === productoId);

      if (!producto) continue;

      const nuevoStock = calculateProductStockAfterInsumoConsumption(
        producto,
        cantidadConsumida
      );

      const { error } = await supabase
        .from("productos")
        .update(nuevoStock)
        .eq("id", producto.id)
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
      `Vas a registrar una atención por ${formatCurrency(
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
          colaborador_id: colaborador?.id ?? null,
          tipo_atencion: "directa",
          estado: "cobrada",
          total_servicios: totalServicios,
          total_productos: totalProductos,
          descuento: 0,
          total_final: total,
          observaciones: observaciones.trim() || null,
        })
        .select("*")
        .single();

      if (atencionError) throw atencionError;

      if (serviciosSeleccionados.length > 0) {
        const serviciosPayload = serviciosSeleccionados.map((item) => ({
          atencion_id: atencion.id,
          servicio_id: item.id,
          colaborador_id: colaborador?.id ?? null,
          nombre_servicio_snapshot: item.nombre,
          precio_lista: item.precio_lista,
          precio_efectivo: item.precio_efectivo,
          precio_cobrado: numberFromInput(item.precio_cobrado),
          cantidad: numberFromInput(item.cantidad),
          subtotal: Number(item.subtotal || 0),
          porcentaje_comision: 0,
          monto_comision: 0,
        }));

        const { error: serviciosError } = await supabase
          .from("atencion_servicios")
          .insert(serviciosPayload);

        if (serviciosError) throw serviciosError;
      }

      await insertAtencionCostosAndDiscountInsumos(atencion.id);

      if (productosSeleccionados.length > 0) {
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
      }

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

      setFeedback("Atención registrada correctamente.");
      resetForm();
      await refreshAppData();
    } catch (error) {
      console.error("Error registrando atención:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        fullError: error,
      });
    } finally {
      setIsSaving(false);
    }
  }

  const currentStockWarnings = getStockWarnings();

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Sin cola obligatoria</span>
        <h2>Registrar atención rápida</h2>
        <p>
          Cargá cliente, servicios, productos vendidos y cobro en un solo flujo.
          La operación queda registrada como atención cobrada.
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

        <div className="sale-picker-grid">
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
                  {formatCurrency(getItemPrice(servicio, tipoPrecio))}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Agregar producto vendido</span>
            <select
              defaultValue=""
              onChange={(event) => {
                addProducto(event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">Seleccionar producto</option>
              {productosVenta.map((producto) => (
                <option key={producto.id} value={producto.id}>
                  {producto.nombre} ·{" "}
                  {formatCurrency(getItemPrice(producto, tipoPrecio))} · Stock:{" "}
                  {producto.stock_actual}
                </option>
              ))}
            </select>
          </label>
        </div>

        <section className="items-list">
          <h3 className="inline-section-title">Servicios</h3>

          {serviciosSeleccionados.length === 0 ? (
            <p className="empty-state">Todavía no agregaste servicios.</p>
          ) : (
            serviciosSeleccionados.map((servicio) => (
              <article key={servicio.tempId} className="line-item">
                <div>
                  <strong>{servicio.nombre}</strong>
                  <small>
                    Lista: {formatCurrency(servicio.precio_lista)} · Efectivo:{" "}
                    {formatCurrency(servicio.precio_efectivo)}
                    {servicio.precio_manual ? " · Precio manual" : ""}
                  </small>
                </div>

                <label className="mini-field">
                  <span>Cantidad</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={servicio.cantidad}
                    onKeyDown={preventInvalidNumberKeys}
                    onChange={(event) =>
                      updateServicioCantidad(servicio.tempId, event.target.value)
                    }
                  />
                </label>

                <label className="mini-field">
                  <span>Precio cobrado</span>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={servicio.precio_cobrado}
                    onKeyDown={preventInvalidNumberKeys}
                    onChange={(event) =>
                      updateServicioPrecio(servicio.tempId, event.target.value)
                    }
                  />
                </label>

                <span>{formatCurrency(servicio.subtotal)}</span>

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
          <span>Total atención</span>
          <strong>{formatCurrency(total)}</strong>
        </div>

        {feedback && <p className="form-feedback">{feedback}</p>}

        <div className="form-actions">
          <button type="button" className="btn btn-ghost" onClick={resetForm}>
            <FiScissors />
            Limpiar
          </button>

          <button type="submit" className="btn btn-primary" disabled={isSaving}>
            <FiSave />
            {isSaving ? "Guardando..." : "Guardar atención"}
          </button>
        </div>
      </form>
    </PageShell>
  );
}