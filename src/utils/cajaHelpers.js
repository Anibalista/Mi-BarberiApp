function normalizeTextLocal(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function getArgentinaDateValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function isCashPayment(medioPago) {
  if (!medioPago) return false;

  const tipo = normalizeTextLocal(medioPago.tipo);
  const nombre = normalizeTextLocal(medioPago.nombre);

  return tipo === "efectivo" || nombre.includes("efectivo");
}

function mergeAllocations(allocations) {
  const merged = new Map();

  allocations.forEach((allocation) => {
    if (roundMoney(allocation.monto) <= 0) return;

    const key = [
      allocation.tipo_caja,
      allocation.medio_pago_id,
      allocation.origen,
      allocation.descripcion,
    ].join("|");

    const current = merged.get(key);

    if (current) {
      merged.set(key, {
        ...current,
        monto: roundMoney(Number(current.monto || 0) + Number(allocation.monto || 0)),
      });
      return;
    }

    merged.set(key, {
      ...allocation,
      monto: roundMoney(allocation.monto),
    });
  });

  return Array.from(merged.values());
}

export function allocateAtencionPayments({ pagos, mediosPago, totalServicios, totalProductos }) {
  const medioPagoById = new Map(mediosPago.map((medio) => [medio.id, medio]));
  const remainingPayments = pagos
    .map((pago) => ({
      medio_pago_id: pago.medio_pago_id,
      montoDisponible: roundMoney(pago.monto),
      medioPago: medioPagoById.get(pago.medio_pago_id),
    }))
    .filter((pago) => pago.medio_pago_id && pago.montoDisponible > 0);

  const digitalPayments = remainingPayments.filter((pago) => !isCashPayment(pago.medioPago));
  const cashPayments = remainingPayments.filter((pago) => isCashPayment(pago.medioPago));

  const allocations = [];
  let serviciosRestantes = roundMoney(totalServicios);
  let productosRestantes = roundMoney(totalProductos);

  function takeFromPayments(payments, tipoCaja, amountGetter, amountSetter, origen, descripcion) {
    let amountLeft = amountGetter();

    for (const payment of payments) {
      if (amountLeft <= 0) break;
      if (payment.montoDisponible <= 0) continue;

      const amountToUse = roundMoney(Math.min(payment.montoDisponible, amountLeft));

      if (amountToUse <= 0) continue;

      allocations.push({
        medio_pago_id: payment.medio_pago_id,
        tipo_caja: tipoCaja,
        monto: amountToUse,
        origen,
        descripcion,
      });

      payment.montoDisponible = roundMoney(payment.montoDisponible - amountToUse);
      amountLeft = roundMoney(amountLeft - amountToUse);
    }

    amountSetter(amountLeft);
  }

  // Regla del negocio:
  // 1) Los pagos digitales cubren servicios primero.
  // 2) Si faltan servicios, se completa con efectivo.
  // 3) El efectivo restante cubre productos.
  // 4) Si todavía faltan productos, se usa digital restante.
  takeFromPayments(
    digitalPayments,
    "servicios",
    () => serviciosRestantes,
    (value) => {
      serviciosRestantes = value;
    },
    "atencion_servicio",
    "Ingreso por servicios en atención"
  );

  takeFromPayments(
    cashPayments,
    "servicios",
    () => serviciosRestantes,
    (value) => {
      serviciosRestantes = value;
    },
    "atencion_servicio",
    "Ingreso por servicios en atención"
  );

  takeFromPayments(
    cashPayments,
    "productos",
    () => productosRestantes,
    (value) => {
      productosRestantes = value;
    },
    "atencion_producto",
    "Ingreso por productos vendidos en atención"
  );

  takeFromPayments(
    digitalPayments,
    "productos",
    () => productosRestantes,
    (value) => {
      productosRestantes = value;
    },
    "atencion_producto",
    "Ingreso por productos vendidos en atención"
  );

  if (serviciosRestantes > 0.01 || productosRestantes > 0.01) {
    throw new Error("Los pagos cargados no alcanzan para cubrir la atención.");
  }

  return mergeAllocations(allocations);
}

export function allocateVentaProductoPayments({ pagos }) {
  return mergeAllocations(
    pagos
      .filter((pago) => pago.medio_pago_id && roundMoney(pago.monto) > 0)
      .map((pago) => ({
        medio_pago_id: pago.medio_pago_id,
        tipo_caja: "productos",
        monto: roundMoney(pago.monto),
        origen: "venta_producto",
        descripcion: "Ingreso por venta de productos",
      }))
  );
}

export async function getOrCreateOpenCaja({
  supabase,
  negocioId,
  sucursalId,
  tipoCaja,
  medioPagoId,
  usuarioAperturaId = null,
  fechaOperativa = getArgentinaDateValue(),
}) {
  const baseQuery = supabase
    .from("cajas")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("sucursal_id", sucursalId)
    .eq("fecha_operativa", fechaOperativa)
    .eq("tipo_caja", tipoCaja)
    .eq("medio_pago_id", medioPagoId)
    .eq("estado", "abierta");

  const { data: existingCaja, error: existingError } = await baseQuery.maybeSingle();

  if (existingError) throw existingError;
  if (existingCaja) return existingCaja;

  const { data: createdCaja, error: createError } = await supabase
    .from("cajas")
    .insert({
      negocio_id: negocioId,
      sucursal_id: sucursalId,
      tipo_caja: tipoCaja,
      medio_pago_id: medioPagoId,
      fecha_operativa: fechaOperativa,
      origen_apertura: "automatica",
      usuario_apertura_id: usuarioAperturaId,
      monto_inicial: 0,
      monto_esperado: 0,
      estado: "abierta",
    })
    .select("*")
    .single();

  if (!createError) return createdCaja;

  // Si dos operaciones intentan abrir la misma caja al mismo tiempo,
  // reconsultamos por el índice único de caja abierta.
  const { data: retryCaja, error: retryError } = await supabase
    .from("cajas")
    .select("*")
    .eq("negocio_id", negocioId)
    .eq("sucursal_id", sucursalId)
    .eq("fecha_operativa", fechaOperativa)
    .eq("tipo_caja", tipoCaja)
    .eq("medio_pago_id", medioPagoId)
    .eq("estado", "abierta")
    .maybeSingle();

  if (retryError) throw retryError;
  if (retryCaja) return retryCaja;

  throw createError;
}

export async function registerCajaIncome({
  supabase,
  negocioId,
  sucursalId,
  atencionId,
  clienteId,
  medioPagoId,
  tipoCaja,
  monto,
  origen,
  descripcion,
  usuarioAperturaId = null,
}) {
  const cleanMonto = roundMoney(monto);

  if (cleanMonto <= 0) return null;

  const fechaOperativa = getArgentinaDateValue();

  const caja = await getOrCreateOpenCaja({
    supabase,
    negocioId,
    sucursalId,
    tipoCaja,
    medioPagoId,
    usuarioAperturaId,
    fechaOperativa,
  });

  const { data: pago, error: pagoError } = await supabase
    .from("pagos")
    .insert({
      negocio_id: negocioId,
      sucursal_id: sucursalId,
      atencion_id: atencionId,
      caja_id: caja.id,
      cliente_id: clienteId,
      monto: cleanMonto,
      medio_pago_id: medioPagoId,
      tipo_caja: tipoCaja,
      estado: "registrado",
    })
    .select("*")
    .single();

  if (pagoError) throw pagoError;

  const { error: movimientoError } = await supabase
    .from("caja_movimientos")
    .insert({
      negocio_id: negocioId,
      sucursal_id: sucursalId,
      caja_id: caja.id,
      atencion_id: atencionId,
      pago_id: pago.id,
      cliente_id: clienteId,
      medio_pago_id: medioPagoId,
      tipo_caja: tipoCaja,
      tipo_movimiento: "ingreso",
      origen,
      monto: cleanMonto,
      descripcion,
      fecha_operativa: caja.fecha_operativa || fechaOperativa,
    });

  if (movimientoError) throw movimientoError;

  const nextMontoEsperado = roundMoney(Number(caja.monto_esperado || 0) + cleanMonto);

  const { error: cajaUpdateError } = await supabase
    .from("cajas")
    .update({
      monto_esperado: nextMontoEsperado,
    })
    .eq("id", caja.id)
    .eq("negocio_id", negocioId);

  if (cajaUpdateError) throw cajaUpdateError;

  return {
    caja,
    pago,
    monto: cleanMonto,
  };
}