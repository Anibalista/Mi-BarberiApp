import { useEffect, useMemo, useState } from "react";
import {
  FiArrowDownCircle,
  FiArrowUpCircle,
  FiCalendar,
  FiCreditCard,
  FiDollarSign,
  FiPackage,
  FiRefreshCw,
  FiScissors,
  FiTrendingUp,
} from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../lib/supabaseClient";
import { formatCurrency } from "../utils/formatters";

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

function formatDateValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function getArgentinaDateValue(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function dateFromInputValue(dateValue) {
  return new Date(`${dateValue}T00:00:00`);
}

function getPresetRange(preset) {
  const today = getArgentinaDateValue();
  const todayDate = dateFromInputValue(today);

  if (preset === "week") {
    const day = todayDate.getDay();
    const mondayOffset = day === 0 ? -6 : 1 - day;
    const monday = new Date(todayDate);

    monday.setDate(todayDate.getDate() + mondayOffset);

    return {
      from: formatDateValue(monday),
      to: today,
    };
  }

  if (preset === "month") {
    const firstDay = new Date(todayDate.getFullYear(), todayDate.getMonth(), 1);

    return {
      from: formatDateValue(firstDay),
      to: today,
    };
  }

  return {
    from: today,
    to: today,
  };
}

function formatDateLabel(dateValue) {
  if (!dateValue) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(dateFromInputValue(dateValue));
}

function formatDateTimeLabel(value) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function isCashPayment(medioPago) {
  if (!medioPago) return false;

  const tipo = normalizeTextLocal(medioPago.tipo);
  const nombre = normalizeTextLocal(medioPago.nombre);

  return tipo === "efectivo" || nombre.includes("efectivo");
}

function getMedioPagoName(medioPago) {
  return medioPago?.nombre || "Sin medio";
}

function getMovimientoSign(tipoMovimiento) {
  if (["egreso", "retiro", "anulacion"].includes(tipoMovimiento)) {
    return -1;
  }

  return 1;
}

function getMovimientoLabel(movimiento) {
  const labels = {
    ingreso: "Ingreso",
    egreso: "Egreso",
    ajuste: "Ajuste",
    retiro: "Retiro",
    anulacion: "Anulación",
  };

  return labels[movimiento.tipo_movimiento] || movimiento.tipo_movimiento || "Movimiento";
}

function getOrigenLabel(origen) {
  const labels = {
    atencion_servicio: "Atención · servicio",
    atencion_producto: "Atención · producto",
    venta_producto: "Venta de producto",
    egreso_manual: "Egreso manual",
    ajuste_manual: "Ajuste manual",
    retiro_propietario: "Retiro del propietario",
    anulacion: "Anulación",
    manual: "Manual",
  };

  return labels[origen] || origen || "Sin origen";
}

function buildGroupedSummary(items, getKey, buildEmpty) {
  const grouped = new Map();

  items.forEach((item) => {
    const key = getKey(item);
    const current = grouped.get(key) || buildEmpty(item);
    const signedAmount =
      getMovimientoSign(item.tipo_movimiento) * Number(item.monto || 0);

    grouped.set(key, {
      ...current,
      ingresos:
        item.tipo_movimiento === "ingreso"
          ? roundMoney(Number(current.ingresos || 0) + Number(item.monto || 0))
          : current.ingresos,
      salidas:
        getMovimientoSign(item.tipo_movimiento) < 0
          ? roundMoney(Number(current.salidas || 0) + Number(item.monto || 0))
          : current.salidas,
      ajustes:
        item.tipo_movimiento === "ajuste"
          ? roundMoney(Number(current.ajustes || 0) + Number(item.monto || 0))
          : current.ajustes,
      neto: roundMoney(Number(current.neto || 0) + signedAmount),
      cantidad: Number(current.cantidad || 0) + 1,
    });
  });

  return Array.from(grouped.values());
}

export default function FinanzasPage() {
  const { negocio, sucursal, mediosPago } = useAppData();

  const [rangePreset, setRangePreset] = useState("today");
  const [dateFrom, setDateFrom] = useState(() => getPresetRange("today").from);
  const [dateTo, setDateTo] = useState(() => getPresetRange("today").to);
  const [movimientos, setMovimientos] = useState([]);
  const [cajas, setCajas] = useState([]);
  const [movementTypeFilter, setMovementTypeFilter] = useState("todos");
  const [cashFilter, setCashFilter] = useState("todos");
  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const mediosPagoById = useMemo(
    () => new Map(mediosPago.map((medio) => [medio.id, medio])),
    [mediosPago]
  );

  const movimientosConMedio = useMemo(
    () =>
      movimientos.map((movimiento) => ({
        ...movimiento,
        medioPago: mediosPagoById.get(movimiento.medio_pago_id),
      })),
    [movimientos, mediosPagoById]
  );

  const filteredMovimientos = useMemo(
    () =>
      movimientosConMedio.filter((movimiento) => {
        const movementTypeMatches =
          movementTypeFilter === "todos" ||
          movimiento.tipo_movimiento === movementTypeFilter ||
          movimiento.tipo_caja === movementTypeFilter;

        const cashMatches =
          cashFilter === "todos" ||
          (cashFilter === "efectivo" && isCashPayment(movimiento.medioPago)) ||
          (cashFilter === "digital" && !isCashPayment(movimiento.medioPago));

        return movementTypeMatches && cashMatches;
      }),
    [movimientosConMedio, movementTypeFilter, cashFilter]
  );

  const summary = useMemo(() => {
    const ingresos = movimientosConMedio
      .filter((movimiento) => movimiento.tipo_movimiento === "ingreso")
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const salidas = movimientosConMedio
      .filter((movimiento) => getMovimientoSign(movimiento.tipo_movimiento) < 0)
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const ajustes = movimientosConMedio
      .filter((movimiento) => movimiento.tipo_movimiento === "ajuste")
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const ingresosServicios = movimientosConMedio
      .filter(
        (movimiento) =>
          movimiento.tipo_movimiento === "ingreso" &&
          movimiento.tipo_caja === "servicios"
      )
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const ingresosProductos = movimientosConMedio
      .filter(
        (movimiento) =>
          movimiento.tipo_movimiento === "ingreso" &&
          movimiento.tipo_caja === "productos"
      )
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const ingresosEfectivo = movimientosConMedio
      .filter(
        (movimiento) =>
          movimiento.tipo_movimiento === "ingreso" &&
          isCashPayment(movimiento.medioPago)
      )
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const ingresosDigital = movimientosConMedio
      .filter(
        (movimiento) =>
          movimiento.tipo_movimiento === "ingreso" &&
          !isCashPayment(movimiento.medioPago)
      )
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const cajasAbiertas = cajas.filter((caja) => caja.estado !== "cerrada").length;
    const cajasCerradas = cajas.filter((caja) => caja.estado === "cerrada").length;

    return {
      ingresos: roundMoney(ingresos),
      salidas: roundMoney(salidas),
      ajustes: roundMoney(ajustes),
      neto: roundMoney(ingresos + ajustes - salidas),
      ingresosServicios: roundMoney(ingresosServicios),
      ingresosProductos: roundMoney(ingresosProductos),
      ingresosEfectivo: roundMoney(ingresosEfectivo),
      ingresosDigital: roundMoney(ingresosDigital),
      movimientos: movimientosConMedio.length,
      cajasAbiertas,
      cajasCerradas,
    };
  }, [movimientosConMedio, cajas]);

  const resumenPorTipoCaja = useMemo(
    () =>
      buildGroupedSummary(
        movimientosConMedio,
        (movimiento) => movimiento.tipo_caja || "sin_tipo",
        (movimiento) => ({
          id: movimiento.tipo_caja || "sin_tipo",
          label:
            movimiento.tipo_caja === "servicios"
              ? "Servicios"
              : movimiento.tipo_caja === "productos"
                ? "Productos"
                : "Sin tipo",
          ingresos: 0,
          salidas: 0,
          ajustes: 0,
          neto: 0,
          cantidad: 0,
        })
      ),
    [movimientosConMedio]
  );

  const resumenPorMedioPago = useMemo(
    () =>
      buildGroupedSummary(
        movimientosConMedio,
        (movimiento) => movimiento.medio_pago_id || "sin_medio",
        (movimiento) => {
          const medioPago = mediosPagoById.get(movimiento.medio_pago_id);

          return {
            id: movimiento.medio_pago_id || "sin_medio",
            label: getMedioPagoName(medioPago),
            tipo: isCashPayment(medioPago) ? "Efectivo" : "Digital",
            ingresos: 0,
            salidas: 0,
            ajustes: 0,
            neto: 0,
            cantidad: 0,
          };
        }
      ),
    [movimientosConMedio, mediosPagoById]
  );

  async function loadFinanceData() {
    if (!negocio?.id || !sucursal?.id) return;

    try {
      setIsLoading(true);
      setFeedback("");

      const { data: movimientosData, error: movimientosError } = await supabase
        .from("caja_movimientos")
        .select("*")
        .eq("negocio_id", negocio.id)
        .eq("sucursal_id", sucursal.id)
        .gte("fecha_operativa", dateFrom)
        .lte("fecha_operativa", dateTo)
        .order("fecha_hora", { ascending: false });

      if (movimientosError) throw movimientosError;

      const { data: cajasData, error: cajasError } = await supabase
        .from("cajas")
        .select("*")
        .eq("negocio_id", negocio.id)
        .eq("sucursal_id", sucursal.id)
        .gte("fecha_operativa", dateFrom)
        .lte("fecha_operativa", dateTo)
        .order("fecha_operativa", { ascending: false });

      if (cajasError) throw cajasError;

      setMovimientos(movimientosData ?? []);
      setCajas(cajasData ?? []);
    } catch (error) {
      console.error("Error cargando finanzas:", error);
      setFeedback("No se pudieron cargar las finanzas.");
    } finally {
      setIsLoading(false);
    }
  }

  function handlePresetChange(nextPreset) {
    setRangePreset(nextPreset);

    if (nextPreset === "custom") return;

    const nextRange = getPresetRange(nextPreset);

    setDateFrom(nextRange.from);
    setDateTo(nextRange.to);
  }

  useEffect(() => {
    loadFinanceData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id, sucursal?.id, dateFrom, dateTo]);

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Finanzas</span>
        <h2>Resumen financiero</h2>
        <p>
          Mirá ingresos, salidas, cajas y movimientos por período. La caja diaria
          sirve para operar; esta vista sirve para entender cómo viene el negocio.
        </p>
      </section>

      <section className="work-card finance-filter-card">
        <div className="toolbar finance-toolbar">
          <div>
            <strong>Período</strong>
            <small>
              {formatDateLabel(dateFrom)} al {formatDateLabel(dateTo)}
            </small>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={loadFinanceData}
            disabled={isLoading}
          >
            <FiRefreshCw />
            {isLoading ? "Actualizando..." : "Actualizar"}
          </button>
        </div>

        <div className="finance-preset-row">
          <button
            type="button"
            className={`chip-button ${rangePreset === "today" ? "is-active" : ""}`}
            onClick={() => handlePresetChange("today")}
          >
            Hoy
          </button>

          <button
            type="button"
            className={`chip-button ${rangePreset === "week" ? "is-active" : ""}`}
            onClick={() => handlePresetChange("week")}
          >
            Semana
          </button>

          <button
            type="button"
            className={`chip-button ${rangePreset === "month" ? "is-active" : ""}`}
            onClick={() => handlePresetChange("month")}
          >
            Mes
          </button>

          <button
            type="button"
            className={`chip-button ${rangePreset === "custom" ? "is-active" : ""}`}
            onClick={() => handlePresetChange("custom")}
          >
            Personalizado
          </button>
        </div>

        <div className="finance-date-grid">
          <label className="form-field">
            <span>Desde</span>
            <input
              type="date"
              value={dateFrom}
              onChange={(event) => {
                setRangePreset("custom");
                setDateFrom(event.target.value);
              }}
            />
          </label>

          <label className="form-field">
            <span>Hasta</span>
            <input
              type="date"
              value={dateTo}
              onChange={(event) => {
                setRangePreset("custom");
                setDateTo(event.target.value);
              }}
            />
          </label>
        </div>
      </section>

      {feedback && <p className="form-feedback">{feedback}</p>}

      <section className="stats-grid finance-stats-grid">
        <article className="stat-card">
          <FiTrendingUp />
          <span>Resultado neto</span>
          <strong>{formatCurrency(summary.neto)}</strong>
          <small>Ingresos + ajustes - salidas</small>
        </article>

        <article className="stat-card">
          <FiArrowUpCircle />
          <span>Ingresos</span>
          <strong>{formatCurrency(summary.ingresos)}</strong>
          <small>{summary.movimientos} movimientos</small>
        </article>

        <article className="stat-card">
          <FiArrowDownCircle />
          <span>Salidas</span>
          <strong>{formatCurrency(summary.salidas)}</strong>
          <small>Egresos, retiros y anulaciones</small>
        </article>

        <article className="stat-card">
          <FiDollarSign />
          <span>Efectivo</span>
          <strong>{formatCurrency(summary.ingresosEfectivo)}</strong>
          <small>Ingresos cobrados en efectivo</small>
        </article>

        <article className="stat-card">
          <FiCreditCard />
          <span>Digital / MP</span>
          <strong>{formatCurrency(summary.ingresosDigital)}</strong>
          <small>Mercado Pago, transferencia o tarjeta</small>
        </article>

        <article className="stat-card">
          <FiCalendar />
          <span>Cajas</span>
          <strong>
            {summary.cajasAbiertas} abiertas · {summary.cajasCerradas} cerradas
          </strong>
          <small>Según fecha operativa</small>
        </article>
      </section>

      <section className="finance-summary-grid">
        <article className="work-card finance-panel">
          <div className="toolbar">
            <div>
              <strong>Ingresos por área</strong>
              <small>Separación entre servicios y productos.</small>
            </div>
          </div>

          <div className="finance-two-cards">
            <div className="finance-mini-card">
              <FiScissors />
              <span>Servicios</span>
              <strong>{formatCurrency(summary.ingresosServicios)}</strong>
            </div>

            <div className="finance-mini-card">
              <FiPackage />
              <span>Productos</span>
              <strong>{formatCurrency(summary.ingresosProductos)}</strong>
            </div>
          </div>

          <div className="finance-table-list">
            {resumenPorTipoCaja.length === 0 ? (
              <p className="empty-state">Todavía no hay movimientos en este período.</p>
            ) : (
              resumenPorTipoCaja.map((item) => (
                <article key={item.id} className="finance-row-card">
                  <div>
                    <strong>{item.label}</strong>
                    <small>{item.cantidad} movimientos</small>
                  </div>
                  <span>{formatCurrency(item.ingresos)}</span>
                </article>
              ))
            )}
          </div>
        </article>

        <article className="work-card finance-panel">
          <div className="toolbar">
            <div>
              <strong>Ingresos por medio de pago</strong>
              <small>Sirve para comparar efectivo contra digital.</small>
            </div>
          </div>

          <div className="finance-table-list">
            {resumenPorMedioPago.length === 0 ? (
              <p className="empty-state">Todavía no hay cobros en este período.</p>
            ) : (
              resumenPorMedioPago.map((item) => (
                <article key={item.id} className="finance-row-card">
                  <div>
                    <strong>{item.label}</strong>
                    <small>
                      {item.tipo} · {item.cantidad} movimientos
                    </small>
                  </div>
                  <span>{formatCurrency(item.ingresos)}</span>
                </article>
              ))
            )}
          </div>
        </article>
      </section>

      <section className="work-card finance-panel">
        <div className="toolbar finance-toolbar">
          <div>
            <strong>Movimientos del período</strong>
            <small>Ingresos, egresos, retiros, ajustes y anulaciones.</small>
          </div>
        </div>

        <div className="finance-filter-inline">
          <label className="form-field">
            <span>Tipo</span>
            <select
              value={movementTypeFilter}
              onChange={(event) => setMovementTypeFilter(event.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="ingreso">Ingresos</option>
              <option value="egreso">Egresos</option>
              <option value="retiro">Retiros</option>
              <option value="ajuste">Ajustes</option>
              <option value="anulacion">Anulaciones</option>
              <option value="servicios">Solo servicios</option>
              <option value="productos">Solo productos</option>
            </select>
          </label>

          <label className="form-field">
            <span>Medio</span>
            <select
              value={cashFilter}
              onChange={(event) => setCashFilter(event.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="efectivo">Efectivo</option>
              <option value="digital">Digital / MP</option>
            </select>
          </label>
        </div>

        {isLoading ? (
          <p className="empty-state">Cargando movimientos...</p>
        ) : filteredMovimientos.length === 0 ? (
          <p className="empty-state">No hay movimientos para mostrar.</p>
        ) : (
          <div className="finance-movement-list">
            {filteredMovimientos.map((movimiento) => {
              const sign = getMovimientoSign(movimiento.tipo_movimiento);
              const amountClass = sign < 0 ? "is-negative" : "is-positive";

              return (
                <article key={movimiento.id} className="finance-movement-card">
                  <div className="finance-movement-main">
                    <span className={`movement-dot ${amountClass}`} />
                    <div>
                      <strong>{getMovimientoLabel(movimiento)}</strong>
                      <small>
                        {getOrigenLabel(movimiento.origen)} ·{" "}
                        {movimiento.tipo_caja || "Sin caja"} ·{" "}
                        {getMedioPagoName(movimiento.medioPago)}
                      </small>
                      {movimiento.descripcion && (
                        <small>{movimiento.descripcion}</small>
                      )}
                    </div>
                  </div>

                  <div className="finance-movement-amount">
                    <strong className={amountClass}>
                      {sign < 0 ? "-" : ""}
                      {formatCurrency(Number(movimiento.monto || 0))}
                    </strong>
                    <small>{formatDateTimeLabel(movimiento.fecha_hora)}</small>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="work-card finance-panel">
        <div className="toolbar">
          <div>
            <strong>Cajas del período</strong>
            <small>Resumen de cajas abiertas, cerradas o reabiertas.</small>
          </div>
        </div>

        {cajas.length === 0 ? (
          <p className="empty-state">No hay cajas en este período.</p>
        ) : (
          <div className="finance-cashbox-list">
            {cajas.map((caja) => {
              const medioPago = mediosPagoById.get(caja.medio_pago_id);

              return (
                <article key={caja.id} className="finance-row-card">
                  <div>
                    <strong>
                      {caja.tipo_caja === "servicios" ? "Servicios" : "Productos"} ·{" "}
                      {getMedioPagoName(medioPago)}
                    </strong>
                    <small>
                      {formatDateLabel(caja.fecha_operativa)} · Estado: {caja.estado}
                    </small>
                  </div>

                  <div className="finance-row-amounts">
                    <span>Esperado: {formatCurrency(caja.monto_esperado)}</span>
                    {caja.monto_real !== null && caja.monto_real !== undefined && (
                      <span>Real: {formatCurrency(caja.monto_real)}</span>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </PageShell>
  );
}
