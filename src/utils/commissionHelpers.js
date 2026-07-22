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

function getRpcRow(data) {
  if (Array.isArray(data)) {
    return data[0] ?? null;
  }

  return data ?? null;
}

export async function resolveServiceCommissionSnapshot({
  supabase,
  negocioId,
  colaboradorId,
  servicioId,
  subtotal,
  cantidad = 1,
  fecha = getArgentinaDateValue(),
}) {
  if (!negocioId || !colaboradorId || !servicioId) {
    throw new Error(
      "Faltan datos para calcular automáticamente la comisión del servicio."
    );
  }

  const { data, error } = await supabase.rpc(
    "resolver_comision_servicio",
    {
      p_negocio_id: negocioId,
      p_colaborador_id: colaboradorId,
      p_servicio_id: servicioId,
      p_fecha: fecha,
    }
  );

  if (error) throw error;

  const result = getRpcRow(data);

  const percentage =
    result?.porcentaje === null || result?.porcentaje === undefined
      ? null
      : Number(result.porcentaje);

  const fixedAmount =
    result?.monto_fijo === null || result?.monto_fijo === undefined
      ? null
      : Number(result.monto_fijo);

  const commissionAmount =
    fixedAmount !== null
      ? roundMoney(fixedAmount * Number(cantidad || 0))
      : roundMoney(
          (Number(subtotal || 0) * Number(percentage || 0)) / 100
        );

  return {
    porcentaje_comision: percentage ?? 0,
    monto_comision: commissionAmount,
    fuente: result?.fuente || "sin_configurar",
    regla_id: result?.regla_id || null,
    monto_fijo: fixedAmount,
  };
}

export async function resolveProductCommissionSnapshot({
  supabase,
  negocioId,
  productoId,
  subtotal,
}) {
  if (!negocioId || !productoId) {
    throw new Error(
      "Faltan datos para calcular automáticamente la comisión del producto."
    );
  }

  const { data, error } = await supabase.rpc(
    "resolver_comision_producto",
    {
      p_negocio_id: negocioId,
      p_producto_id: productoId,
    }
  );

  if (error) throw error;

  const result = getRpcRow(data);
  const percentage = Number(result?.porcentaje || 0);

  return {
    porcentaje_comision: percentage,
    monto_comision: roundMoney(
      (Number(subtotal || 0) * percentage) / 100
    ),
    fuente_comision: result?.fuente || "sin_configurar",
  };
}