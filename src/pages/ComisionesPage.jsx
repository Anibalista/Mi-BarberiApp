import { useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiCalendar,
  FiDollarSign,
  FiRefreshCw,
  FiScissors,
  FiUser,
} from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../lib/supabaseClient";
import { normalizeText } from "../utils/formGuards";
import { formatCurrency } from "../utils/formatters";

function toDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function addDays(date, days) {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + days);
  return nextDate;
}

function getStartOfWeek(date = new Date()) {
  const currentDate = new Date(date);
  const day = currentDate.getDay();
  const mondayDiff = day === 0 ? -6 : 1 - day;
  currentDate.setDate(currentDate.getDate() + mondayDiff);
  return currentDate;
}

function getPeriodRange(period, customStart, customEnd) {
  const today = new Date();

  if (period === "semana") {
    const start = getStartOfWeek(today);
    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(today),
    };
  }

  if (period === "mes") {
    const start = new Date(today.getFullYear(), today.getMonth(), 1);
    return {
      startDate: toDateInputValue(start),
      endDate: toDateInputValue(today),
    };
  }

  if (period === "personalizado") {
    return {
      startDate: customStart || toDateInputValue(today),
      endDate: customEnd || customStart || toDateInputValue(today),
    };
  }

  return {
    startDate: toDateInputValue(today),
    endDate: toDateInputValue(today),
  };
}

function buildIsoRange(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T23:59:59.999`);

  return {
    startIso: start.toISOString(),
    endIso: end.toISOString(),
  };
}

function formatDateTime(value) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function roundMoney(value) {
  return Math.round(Number(value || 0) * 100) / 100;
}

function isCashPayment(medioPago) {
  if (!medioPago) return false;

  const tipo = normalizeText(medioPago.tipo);
  const nombre = normalizeText(medioPago.nombre);

  return tipo === "efectivo" || nombre.includes("efectivo");
}

function chunkArray(items, size = 80) {
  const chunks = [];

  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size));
  }

  return chunks;
}

async function fetchByAtencionIds(tableName, atencionIds, select = "*") {
  if (atencionIds.length === 0) return [];

  const chunks = chunkArray(atencionIds);
  const results = [];

  for (const chunk of chunks) {
    const { data, error } = await supabase
      .from(tableName)
      .select(select)
      .in("atencion_id", chunk);

    if (error) throw error;
    results.push(...(data ?? []));
  }

  return results;
}

export default function ComisionesPage() {
  const { negocio, sucursal, mediosPago, clientes } = useAppData();

  const [period, setPeriod] = useState("hoy");
  const [customStart, setCustomStart] = useState(toDateInputValue());
  const [customEnd, setCustomEnd] = useState(toDateInputValue());
  const [selectedColaboradorId, setSelectedColaboradorId] = useState("todos");

  const [colaboradores, setColaboradores] = useState([]);
  const [atenciones, setAtenciones] = useState([]);
  const [serviciosAtendidos, setServiciosAtendidos] = useState([]);
  const [movimientosServicios, setMovimientosServicios] = useState([]);

  const [isLoading, setIsLoading] = useState(false);
  const [feedback, setFeedback] = useState("");

  const periodRange = useMemo(
    () => getPeriodRange(period, customStart, customEnd),
    [period, customStart, customEnd]
  );

  const mediosPagoById = useMemo(
    () => new Map(mediosPago.map((medio) => [medio.id, medio])),
    [mediosPago]
  );

  const clientesById = useMemo(
    () => new Map(clientes.map((cliente) => [cliente.id, cliente])),
    [clientes]
  );

  const colaboradoresById = useMemo(
    () => new Map(colaboradores.map((item) => [item.id, item])),
    [colaboradores]
  );

  const colaboradorOptions = useMemo(
    () =>
      colaboradores
        .filter((item) => item.activo || item.es_barbero)
        .sort((a, b) =>
          String(a.nombre_publico || "").localeCompare(
            String(b.nombre_publico || ""),
            "es"
          )
        ),
    [colaboradores]
  );

  async function loadComisionesData() {
    if (!negocio?.id || !sucursal?.id) return;

    try {
      setIsLoading(true);
      setFeedback("");

      const { startIso, endIso } = buildIsoRange(
        periodRange.startDate,
        periodRange.endDate
      );

      const colaboradoresRequest = supabase
        .from("colaboradores")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("nombre_publico", { ascending: true });

      const atencionesRequest = supabase
        .from("atenciones")
        .select(
          "id, negocio_id, sucursal_id, cliente_id, colaborador_id, fecha_hora_inicio, estado, total_servicios, total_final"
        )
        .eq("negocio_id", negocio.id)
        .eq("sucursal_id", sucursal.id)
        .gte("fecha_hora_inicio", startIso)
        .lte("fecha_hora_inicio", endIso)
        .order("fecha_hora_inicio", { ascending: false });

      const movimientosRequest = supabase
        .from("caja_movimientos")
        .select("*")
        .eq("negocio_id", negocio.id)
        .eq("sucursal_id", sucursal.id)
        .eq("tipo_caja", "servicios")
        .eq("tipo_movimiento", "ingreso")
        .gte("fecha_hora", startIso)
        .lte("fecha_hora", endIso)
        .order("fecha_hora", { ascending: false });

      const [colaboradoresResponse, atencionesResponse, movimientosResponse] =
        await Promise.all([
          colaboradoresRequest,
          atencionesRequest,
          movimientosRequest,
        ]);

      if (colaboradoresResponse.error) throw colaboradoresResponse.error;
      if (atencionesResponse.error) throw atencionesResponse.error;
      if (movimientosResponse.error) throw movimientosResponse.error;

      const loadedAtenciones = atencionesResponse.data ?? [];
      const atencionIds = loadedAtenciones.map((atencion) => atencion.id);
      const serviciosRows = await fetchByAtencionIds(
        "atencion_servicios",
        atencionIds
      );

      setColaboradores(colaboradoresResponse.data ?? []);
      setAtenciones(loadedAtenciones);
      setServiciosAtendidos(serviciosRows ?? []);
      setMovimientosServicios(
        (movimientosResponse.data ?? []).filter(
          (movimiento) => movimiento.atencion_id
        )
      );
    } catch (error) {
      console.error("Error cargando comisiones:", error);
      setFeedback("No se pudieron cargar las comisiones.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadComisionesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id, sucursal?.id, periodRange.startDate, periodRange.endDate]);

  const reportData = useMemo(() => {
    const atencionesById = new Map(
      atenciones.map((atencion) => [atencion.id, atencion])
    );

    const serviceTotalsByAtencion = new Map();

    serviciosAtendidos.forEach((servicio) => {
      const current = serviceTotalsByAtencion.get(servicio.atencion_id) || 0;
      serviceTotalsByAtencion.set(
        servicio.atencion_id,
        roundMoney(current + Number(servicio.subtotal || 0))
      );
    });

    const movementTotalsByAtencion = new Map();

    movimientosServicios.forEach((movimiento) => {
      const current = movementTotalsByAtencion.get(movimiento.atencion_id) || {
        efectivo: 0,
        digital: 0,
        total: 0,
      };

      const medioPago = mediosPagoById.get(movimiento.medio_pago_id);
      const monto = Number(movimiento.monto || 0);

      if (isCashPayment(medioPago)) {
        current.efectivo = roundMoney(current.efectivo + monto);
      } else {
        current.digital = roundMoney(current.digital + monto);
      }

      current.total = roundMoney(current.total + monto);
      movementTotalsByAtencion.set(movimiento.atencion_id, current);
    });

    const rows = serviciosAtendidos
      .map((servicio) => {
        const atencion = atencionesById.get(servicio.atencion_id);
        const colaboradorId =
          servicio.colaborador_id || atencion?.colaborador_id || "sin_colaborador";
        const colaborador = colaboradoresById.get(colaboradorId);
        const cliente = clientesById.get(atencion?.cliente_id);
        const subtotal = roundMoney(servicio.subtotal);
        const totalServiciosAtencion =
          roundMoney(serviceTotalsByAtencion.get(servicio.atencion_id)) ||
          roundMoney(atencion?.total_servicios) ||
          subtotal;
        const movimientosAtencion = movementTotalsByAtencion.get(
          servicio.atencion_id
        ) || {
          efectivo: 0,
          digital: 0,
          total: 0,
        };

        const share = totalServiciosAtencion > 0 ? subtotal / totalServiciosAtencion : 0;
        const efectivoBase = roundMoney(movimientosAtencion.efectivo * share);
        const digitalBase = roundMoney(movimientosAtencion.digital * share);
        const baseConMedio = roundMoney(efectivoBase + digitalBase);
        const sinMedioBase = roundMoney(Math.max(subtotal - baseConMedio, 0));

        const porcentajeComision =
          Number(servicio.porcentaje_comision || 0) > 0
            ? Number(servicio.porcentaje_comision || 0)
            : Number(colaborador?.porcentaje_comision_default || 0);

        const montoComision =
          Number(servicio.monto_comision || 0) > 0
            ? roundMoney(servicio.monto_comision)
            : roundMoney((subtotal * porcentajeComision) / 100);

        const efectivoRatio = subtotal > 0 ? efectivoBase / subtotal : 0;
        const digitalRatio = subtotal > 0 ? digitalBase / subtotal : 0;
        const sinMedioRatio = subtotal > 0 ? sinMedioBase / subtotal : 0;

        return {
          id: servicio.id,
          atencionId: servicio.atencion_id,
          fecha: atencion?.fecha_hora_inicio || servicio.creado_en,
          colaboradorId,
          colaboradorNombre: colaborador?.nombre_publico || "Sin barbero asignado",
          clienteNombre:
            `${cliente?.nombre || ""} ${cliente?.apellido || ""}`.trim() ||
            "Cliente sin nombre",
          servicioNombre: servicio.nombre_servicio_snapshot,
          cantidad: Number(servicio.cantidad || 0),
          subtotal,
          efectivoBase,
          digitalBase,
          sinMedioBase,
          porcentajeComision,
          montoComision,
          comisionEfectivo: roundMoney(montoComision * efectivoRatio),
          comisionDigital: roundMoney(montoComision * digitalRatio),
          comisionSinMedio: roundMoney(montoComision * sinMedioRatio),
          hasComisionConfigured:
            Number(servicio.monto_comision || 0) > 0 || porcentajeComision > 0,
        };
      })
      .filter((row) => {
        if (selectedColaboradorId === "todos") return true;
        if (selectedColaboradorId === "sin_colaborador") {
          return row.colaboradorId === "sin_colaborador";
        }

        return row.colaboradorId === selectedColaboradorId;
      })
      .sort((a, b) => new Date(b.fecha) - new Date(a.fecha));

    const summary = rows.reduce(
      (acc, row) => ({
        cantidadServicios: acc.cantidadServicios + row.cantidad,
        totalServicios: roundMoney(acc.totalServicios + row.subtotal),
        totalEfectivo: roundMoney(acc.totalEfectivo + row.efectivoBase),
        totalDigital: roundMoney(acc.totalDigital + row.digitalBase),
        totalSinMedio: roundMoney(acc.totalSinMedio + row.sinMedioBase),
        totalComision: roundMoney(acc.totalComision + row.montoComision),
        comisionEfectivo: roundMoney(acc.comisionEfectivo + row.comisionEfectivo),
        comisionDigital: roundMoney(acc.comisionDigital + row.comisionDigital),
        comisionSinMedio: roundMoney(acc.comisionSinMedio + row.comisionSinMedio),
        serviciosSinComision: acc.serviciosSinComision + (row.hasComisionConfigured ? 0 : 1),
      }),
      {
        cantidadServicios: 0,
        totalServicios: 0,
        totalEfectivo: 0,
        totalDigital: 0,
        totalSinMedio: 0,
        totalComision: 0,
        comisionEfectivo: 0,
        comisionDigital: 0,
        comisionSinMedio: 0,
        serviciosSinComision: 0,
      }
    );

    const groupedByColaborador = Array.from(
      rows.reduce((map, row) => {
        const current = map.get(row.colaboradorId) || {
          colaboradorId: row.colaboradorId,
          colaboradorNombre: row.colaboradorNombre,
          cantidadServicios: 0,
          totalServicios: 0,
          totalEfectivo: 0,
          totalDigital: 0,
          totalComision: 0,
          comisionEfectivo: 0,
          comisionDigital: 0,
        };

        current.cantidadServicios += row.cantidad;
        current.totalServicios = roundMoney(current.totalServicios + row.subtotal);
        current.totalEfectivo = roundMoney(current.totalEfectivo + row.efectivoBase);
        current.totalDigital = roundMoney(current.totalDigital + row.digitalBase);
        current.totalComision = roundMoney(current.totalComision + row.montoComision);
        current.comisionEfectivo = roundMoney(current.comisionEfectivo + row.comisionEfectivo);
        current.comisionDigital = roundMoney(current.comisionDigital + row.comisionDigital);

        map.set(row.colaboradorId, current);
        return map;
      }, new Map()).values()
    ).sort((a, b) => b.totalComision - a.totalComision);

    return {
      rows,
      summary,
      groupedByColaborador,
    };
  }, [
    atenciones,
    serviciosAtendidos,
    movimientosServicios,
    mediosPagoById,
    colaboradoresById,
    clientesById,
    selectedColaboradorId,
  ]);

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Reporte inicial</span>
        <h2>Comisiones</h2>
        <p>
          Controlá servicios realizados, cobros por medio de pago y comisión
          estimada por barbero. Esta versión todavía no marca liquidaciones como
          pagadas.
        </p>
      </section>

      <section className="work-card commissions-filters">
        <div className="toolbar">
          <div>
            <strong>Filtros</strong>
            <small>
              Período: {periodRange.startDate} al {periodRange.endDate}
            </small>
          </div>

          <button
            type="button"
            className="btn btn-ghost"
            onClick={loadComisionesData}
            disabled={isLoading}
          >
            <FiRefreshCw />
            {isLoading ? "Cargando..." : "Actualizar"}
          </button>
        </div>

        <div className="form-grid">
          <label className="form-field">
            <span>Período</span>
            <select value={period} onChange={(event) => setPeriod(event.target.value)}>
              <option value="hoy">Hoy</option>
              <option value="semana">Semana</option>
              <option value="mes">Mes</option>
              <option value="personalizado">Personalizado</option>
            </select>
          </label>

          {period === "personalizado" && (
            <>
              <label className="form-field">
                <span>Desde</span>
                <input
                  type="date"
                  value={customStart}
                  onChange={(event) => setCustomStart(event.target.value)}
                />
              </label>

              <label className="form-field">
                <span>Hasta</span>
                <input
                  type="date"
                  value={customEnd}
                  onChange={(event) => setCustomEnd(event.target.value)}
                />
              </label>
            </>
          )}

          <label className="form-field">
            <span>Barbero</span>
            <select
              value={selectedColaboradorId}
              onChange={(event) => setSelectedColaboradorId(event.target.value)}
            >
              <option value="todos">Todos</option>
              <option value="sin_colaborador">Sin barbero asignado</option>
              {colaboradorOptions.map((colaborador) => (
                <option key={colaborador.id} value={colaborador.id}>
                  {colaborador.nombre_publico}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {feedback && <p className="form-feedback">{feedback}</p>}

      <section className="commissions-summary-grid">
        <article className="stat-card">
          <FiScissors />
          <span>Servicios cobrados</span>
          <strong>{formatCurrency(reportData.summary.totalServicios)}</strong>
          <small>{reportData.summary.cantidadServicios} servicios</small>
        </article>

        <article className="stat-card">
          <FiDollarSign />
          <span>Base digital / MP</span>
          <strong>{formatCurrency(reportData.summary.totalDigital)}</strong>
          <small>Prioridad para servicios en pagos mixtos</small>
        </article>

        <article className="stat-card">
          <FiDollarSign />
          <span>Base efectivo</span>
          <strong>{formatCurrency(reportData.summary.totalEfectivo)}</strong>
          <small>Servicios cobrados en efectivo</small>
        </article>

        <article className="stat-card">
          <FiBriefcase />
          <span>Comisión estimada</span>
          <strong>{formatCurrency(reportData.summary.totalComision)}</strong>
          <small>
            Digital: {formatCurrency(reportData.summary.comisionDigital)} · Efectivo:{" "}
            {formatCurrency(reportData.summary.comisionEfectivo)}
          </small>
        </article>
      </section>

      {reportData.summary.serviciosSinComision > 0 && (
        <div className="stock-warning-box">
          <strong>Hay servicios sin porcentaje de comisión</strong>
          <p>
            {reportData.summary.serviciosSinComision} servicio(s) quedaron con
            comisión estimada en $0 porque no tienen porcentaje guardado ni el
            barbero tiene porcentaje por defecto.
          </p>
        </div>
      )}

      {reportData.summary.totalSinMedio > 0 && (
        <div className="stock-warning-box">
          <strong>Hay servicios sin medio de pago asociado</strong>
          <p>
            {formatCurrency(reportData.summary.totalSinMedio)} en servicios no
            pudo separarse entre efectivo y digital. Puede venir de operaciones
            anteriores a la caja automática.
          </p>
        </div>
      )}

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>Resumen por barbero</strong>
            <small>Comisión estimada según porcentaje del servicio o del barbero.</small>
          </div>
        </div>

        {reportData.groupedByColaborador.length === 0 ? (
          <p className="empty-state">No hay servicios para el período seleccionado.</p>
        ) : (
          <div className="finance-table-wrap">
            <table className="finance-table">
              <thead>
                <tr>
                  <th>Barbero</th>
                  <th>Servicios</th>
                  <th>Total servicios</th>
                  <th>Digital / MP</th>
                  <th>Efectivo</th>
                  <th>Comisión total</th>
                  <th>Comisión digital</th>
                  <th>Comisión efectivo</th>
                </tr>
              </thead>
              <tbody>
                {reportData.groupedByColaborador.map((row) => (
                  <tr key={row.colaboradorId}>
                    <td>
                      <strong>{row.colaboradorNombre}</strong>
                    </td>
                    <td>{row.cantidadServicios}</td>
                    <td>{formatCurrency(row.totalServicios)}</td>
                    <td>{formatCurrency(row.totalDigital)}</td>
                    <td>{formatCurrency(row.totalEfectivo)}</td>
                    <td>{formatCurrency(row.totalComision)}</td>
                    <td>{formatCurrency(row.comisionDigital)}</td>
                    <td>{formatCurrency(row.comisionEfectivo)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>Detalle de servicios</strong>
            <small>
              La separación efectivo/digital se calcula de forma proporcional
              cuando una atención tiene más de un servicio.
            </small>
          </div>
        </div>

        {reportData.rows.length === 0 ? (
          <p className="empty-state">No hay servicios cargados en este período.</p>
        ) : (
          <div className="commission-detail-list">
            {reportData.rows.map((row) => (
              <article key={row.id} className="commission-detail-card">
                <div>
                  <strong>{row.servicioNombre}</strong>
                  <small>
                    {formatDateTime(row.fecha)} · {row.clienteNombre}
                  </small>
                </div>

                <div className="commission-detail-meta">
                  <span>
                    <FiUser /> {row.colaboradorNombre}
                  </span>
                  <span>
                    <FiCalendar /> Cantidad: {row.cantidad}
                  </span>
                </div>

                <div className="commission-detail-grid">
                  <span>
                    Total servicio
                    <strong>{formatCurrency(row.subtotal)}</strong>
                  </span>
                  <span>
                    Digital / MP
                    <strong>{formatCurrency(row.digitalBase)}</strong>
                  </span>
                  <span>
                    Efectivo
                    <strong>{formatCurrency(row.efectivoBase)}</strong>
                  </span>
                  <span>
                    Comisión
                    <strong>{formatCurrency(row.montoComision)}</strong>
                  </span>
                  <span>
                    % aplicado
                    <strong>{row.porcentajeComision}%</strong>
                  </span>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
