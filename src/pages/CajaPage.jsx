import { useEffect, useMemo, useState } from "react";
import {
  FiArchive,
  FiCalendar,
  FiCheck,
  FiCreditCard,
  FiDollarSign,
  FiRefreshCw,
  FiSave,
} from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../lib/supabaseClient";
import { preventInvalidNumberKeys } from "../utils/formGuards";
import { formatCurrency } from "../utils/formatters";

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

function numberFromInput(value) {
  return Number(String(value || "0").replace(",", "."));
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

function formatDateTime(value) {
  if (!value) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(value));
}

function formatCajaTipo(tipoCaja) {
  if (tipoCaja === "servicios") return "Servicios";
  if (tipoCaja === "productos") return "Productos";

  return tipoCaja || "Caja";
}

function formatEstadoCaja(estado) {
  if (estado === "abierta") return "Abierta";
  if (estado === "cerrada") return "Cerrada";
  if (estado === "reabierta") return "Reabierta";

  return estado || "Sin estado";
}

function getMedioPagoName(cajaOrMovimiento) {
  return cajaOrMovimiento?.medios_pago?.nombre || "Sin medio de pago";
}

function normalizeTextLocal(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function isCashPayment(medioPago) {
  if (!medioPago) return false;

  const tipo = normalizeTextLocal(medioPago.tipo);
  const nombre = normalizeTextLocal(medioPago.nombre);

  return tipo === "efectivo" || nombre.includes("efectivo");
}

function formatDifference(value) {
  if (value === null || value === undefined) return "-";
  if (Math.abs(value) <= 0.01) return "Sin diferencia";

  return formatCurrency(value);
}

function getMovimientoSign(tipoMovimiento) {
  if (["egreso", "retiro", "anulacion"].includes(tipoMovimiento)) return -1;

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

  return labels[movimiento.tipo_movimiento] || movimiento.tipo_movimiento;
}

function getOrigenLabel(origen) {
  const labels = {
    atencion_servicio: "Atención - servicios",
    atencion_producto: "Atención - productos",
    venta_producto: "Venta de productos",
    egreso_manual: "Egreso manual",
    ajuste_manual: "Ajuste manual",
    retiro_propietario: "Retiro propietario",
    anulacion: "Anulación",
    manual: "Manual",
  };

  return labels[origen] || origen;
}

export default function CajaPage() {
  const { negocio, sucursal } = useAppData();

  const [fechaOperativa, setFechaOperativa] = useState(getArgentinaDateValue());
  const [cajas, setCajas] = useState([]);
  const [movimientos, setMovimientos] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const [cierreValues, setCierreValues] = useState({});
  const [cierreObservaciones, setCierreObservaciones] = useState({});

  const [egresoCajaId, setEgresoCajaId] = useState("");
  const [egresoMonto, setEgresoMonto] = useState("");
  const [egresoDescripcion, setEgresoDescripcion] = useState("");

  const [controlEfectivo, setControlEfectivo] = useState("");
  const [controlDigital, setControlDigital] = useState("");

  const cajasAbiertas = useMemo(
    () => cajas.filter((caja) => caja.estado === "abierta" || caja.estado === "reabierta"),
    [cajas]
  );

  const resumen = useMemo(() => {
    const ingresos = movimientos
      .filter((movimiento) => movimiento.tipo_movimiento === "ingreso")
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const egresos = movimientos
      .filter((movimiento) => ["egreso", "retiro", "anulacion"].includes(movimiento.tipo_movimiento))
      .reduce((acc, movimiento) => acc + Number(movimiento.monto || 0), 0);

    const esperadoAbierto = cajasAbiertas.reduce(
      (acc, caja) => acc + Number(caja.monto_esperado || 0),
      0
    );

    const totalRealCerrado = cajas
      .filter((caja) => caja.estado === "cerrada")
      .reduce((acc, caja) => acc + Number(caja.monto_real || 0), 0);

    return {
      ingresos: roundMoney(ingresos),
      egresos: roundMoney(egresos),
      esperadoAbierto: roundMoney(esperadoAbierto),
      totalRealCerrado: roundMoney(totalRealCerrado),
    };
  }, [cajas, cajasAbiertas, movimientos]);

  const controlPorMedio = useMemo(() => {
    const base = {
      efectivo: {
        esperadoAbierto: 0,
        esperadoDia: 0,
        cajasAbiertas: 0,
        cajasDia: 0,
      },
      digital: {
        esperadoAbierto: 0,
        esperadoDia: 0,
        cajasAbiertas: 0,
        cajasDia: 0,
      },
    };

    cajas.forEach((caja) => {
      const key = isCashPayment(caja.medios_pago) ? "efectivo" : "digital";
      const montoEsperado = Number(caja.monto_esperado || 0);
      const isOpen = caja.estado === "abierta" || caja.estado === "reabierta";

      base[key].esperadoDia += montoEsperado;
      base[key].cajasDia += 1;

      if (isOpen) {
        base[key].esperadoAbierto += montoEsperado;
        base[key].cajasAbiertas += 1;
      }
    });

    return {
      efectivo: {
        ...base.efectivo,
        esperadoAbierto: roundMoney(base.efectivo.esperadoAbierto),
        esperadoDia: roundMoney(base.efectivo.esperadoDia),
      },
      digital: {
        ...base.digital,
        esperadoAbierto: roundMoney(base.digital.esperadoAbierto),
        esperadoDia: roundMoney(base.digital.esperadoDia),
      },
    };
  }, [cajas]);

  const diferenciaControlEfectivo =
    controlEfectivo === ""
      ? null
      : roundMoney(numberFromInput(controlEfectivo) - controlPorMedio.efectivo.esperadoAbierto);

  const diferenciaControlDigital =
    controlDigital === ""
      ? null
      : roundMoney(numberFromInput(controlDigital) - controlPorMedio.digital.esperadoAbierto);

  async function loadCajaData() {
    if (!negocio?.id || !sucursal?.id) return;

    try {
      setIsLoading(true);
      setFeedback("");

      const [cajasResult, movimientosResult] = await Promise.all([
        supabase
          .from("cajas")
          .select(
            `
            *,
            medios_pago (
              id,
              nombre,
              tipo
            )
          `
          )
          .eq("negocio_id", negocio.id)
          .eq("sucursal_id", sucursal.id)
          .eq("fecha_operativa", fechaOperativa)
          .order("tipo_caja", { ascending: true })
          .order("creado_en", { ascending: true }),

        supabase
          .from("caja_movimientos")
          .select(
            `
            *,
            medios_pago (
              id,
              nombre,
              tipo
            ),
            clientes (
              id,
              nombre,
              apellido
            )
          `
          )
          .eq("negocio_id", negocio.id)
          .eq("sucursal_id", sucursal.id)
          .eq("fecha_operativa", fechaOperativa)
          .order("fecha_hora", { ascending: false }),
      ]);

      if (cajasResult.error) throw cajasResult.error;
      if (movimientosResult.error) throw movimientosResult.error;

      setCajas(cajasResult.data ?? []);
      setMovimientos(movimientosResult.data ?? []);
    } catch (error) {
      console.error("Error cargando caja:", error);
      setFeedback("No se pudo cargar la caja diaria.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadCajaData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id, sucursal?.id, fechaOperativa]);

  function updateCierreValue(cajaId, value) {
    setCierreValues((current) => ({
      ...current,
      [cajaId]: normalizeDecimalInput(value),
    }));
  }

  function updateCierreObservacion(cajaId, value) {
    setCierreObservaciones((current) => ({
      ...current,
      [cajaId]: value,
    }));
  }

  function useExpectedAsReal(caja) {
    updateCierreValue(caja.id, String(roundMoney(caja.monto_esperado)));
  }

  function useExpectedGeneralTotals() {
    setControlEfectivo(String(controlPorMedio.efectivo.esperadoAbierto));
    setControlDigital(String(controlPorMedio.digital.esperadoAbierto));
  }

  function fillExpectedInOpenClosures() {
    const nextValues = {};

    cajasAbiertas.forEach((caja) => {
      nextValues[caja.id] = String(roundMoney(caja.monto_esperado));
    });

    setCierreValues((current) => ({
      ...current,
      ...nextValues,
    }));

    setFeedback("Montos esperados cargados en las cajas abiertas.");
  }

  async function closeCaja(caja) {
    const montoReal = numberFromInput(cierreValues[caja.id]);
    const montoEsperado = roundMoney(caja.monto_esperado);

    if (Number.isNaN(montoReal) || montoReal < 0) {
      setFeedback("Ingresá un monto real válido para cerrar la caja.");
      return;
    }

    const diferencia = roundMoney(montoReal - montoEsperado);
    const shouldClose = window.confirm(
      `Vas a cerrar la caja ${formatCajaTipo(caja.tipo_caja)} / ${getMedioPagoName(caja)}.\n\nEsperado: ${formatCurrency(montoEsperado)}\nReal: ${formatCurrency(montoReal)}\nDiferencia: ${formatCurrency(diferencia)}\n\n¿Confirmás el cierre?`
    );

    if (!shouldClose) return;

    try {
      setIsSaving(true);
      setFeedback("");

      const { error } = await supabase
        .from("cajas")
        .update({
          fecha_cierre: new Date().toISOString(),
          monto_real: roundMoney(montoReal),
          diferencia,
          estado: "cerrada",
          observaciones: cierreObservaciones[caja.id]?.trim() || caja.observaciones || null,
        })
        .eq("id", caja.id)
        .eq("negocio_id", negocio.id);

      if (error) throw error;

      setFeedback("Caja cerrada correctamente.");
      await loadCajaData();
    } catch (error) {
      console.error("Error cerrando caja:", error);
      setFeedback("No se pudo cerrar la caja.");
    } finally {
      setIsSaving(false);
    }
  }

  async function registerManualExpense(event) {
    event.preventDefault();

    const caja = cajasAbiertas.find((item) => item.id === egresoCajaId);
    const monto = roundMoney(numberFromInput(egresoMonto));

    if (!caja) {
      setFeedback("Seleccioná una caja abierta para registrar el egreso.");
      return;
    }

    if (monto <= 0) {
      setFeedback("El egreso debe ser mayor a cero.");
      return;
    }

    if (!egresoDescripcion.trim()) {
      setFeedback("Ingresá una descripción para el egreso.");
      return;
    }

    const shouldSave = window.confirm(
      `Vas a registrar un egreso de ${formatCurrency(monto)} en ${formatCajaTipo(caja.tipo_caja)} / ${getMedioPagoName(caja)}.\n\n¿Confirmás el egreso?`
    );

    if (!shouldSave) return;

    try {
      setIsSaving(true);
      setFeedback("");

      const { error: movimientoError } = await supabase
        .from("caja_movimientos")
        .insert({
          negocio_id: negocio.id,
          sucursal_id: sucursal.id,
          caja_id: caja.id,
          medio_pago_id: caja.medio_pago_id,
          tipo_caja: caja.tipo_caja,
          tipo_movimiento: "egreso",
          origen: "egreso_manual",
          monto,
          descripcion: egresoDescripcion.trim(),
          fecha_operativa: fechaOperativa,
        });

      if (movimientoError) throw movimientoError;

      const nextMontoEsperado = roundMoney(Number(caja.monto_esperado || 0) - monto);

      const { error: cajaError } = await supabase
        .from("cajas")
        .update({
          monto_esperado: nextMontoEsperado,
        })
        .eq("id", caja.id)
        .eq("negocio_id", negocio.id);

      if (cajaError) throw cajaError;

      setEgresoCajaId("");
      setEgresoMonto("");
      setEgresoDescripcion("");
      setFeedback("Egreso registrado correctamente.");
      await loadCajaData();
    } catch (error) {
      console.error("Error registrando egreso:", error);
      setFeedback("No se pudo registrar el egreso.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Caja diaria</span>
        <h2>Cajas y cierre</h2>
        <p>
          Las cajas se abren automáticamente con la primera atención o venta del
          día, separadas por servicios/productos y por medio de pago.
        </p>
      </section>

      <section className="work-card caja-toolbar-card">
        <div className="toolbar">
          <div>
            <strong>Fecha operativa</strong>
            <small>Usá esta fecha para revisar o cerrar cajas de otros días.</small>
          </div>

          <div className="toolbar-actions">
            <label className="form-field caja-date-field">
              <span>Fecha</span>
              <input
                type="date"
                value={fechaOperativa}
                onChange={(event) => setFechaOperativa(event.target.value)}
              />
            </label>

            <button type="button" className="btn btn-ghost" onClick={loadCajaData}>
              <FiRefreshCw />
              Actualizar
            </button>
          </div>
        </div>
      </section>

      <section className="stats-grid caja-summary-grid">
        <article className="stat-card">
          <FiDollarSign />
          <span>Ingresos del día</span>
          <strong>{formatCurrency(resumen.ingresos)}</strong>
        </article>

        <article className="stat-card">
          <FiArchive />
          <span>Cajas abiertas</span>
          <strong>{cajasAbiertas.length}</strong>
        </article>

        <article className="stat-card">
          <FiDollarSign />
          <span>Esperado abierto</span>
          <strong>{formatCurrency(resumen.esperadoAbierto)}</strong>
        </article>

        <article className="stat-card">
          <FiDollarSign />
          <span>Egresos del día</span>
          <strong>{formatCurrency(resumen.egresos)}</strong>
        </article>
      </section>

      {feedback && <p className="form-feedback">{feedback}</p>}

      <section className="work-card caja-control-card">
        <div className="toolbar">
          <div>
            <strong>Control general por medio de pago</strong>
            <small>
              Para cierre rápido: contá efectivo y revisá Mercado Pago/digital sin
              separar servicios de productos. Si coincide, cargá los esperados en
              cada caja individual.
            </small>
          </div>
        </div>

        <div className="caja-control-grid">
          <article className="caja-control-item">
            <div className="caja-control-item__title">
              <FiDollarSign />
              <div>
                <strong>Total efectivo</strong>
                <small>
                  {controlPorMedio.efectivo.cajasAbiertas} cajas abiertas ·
                  esperado {formatCurrency(controlPorMedio.efectivo.esperadoAbierto)}
                </small>
              </div>
            </div>

            <label className="form-field">
              <span>Efectivo contado</span>
              <input
                type="text"
                inputMode="decimal"
                value={controlEfectivo}
                onKeyDown={preventInvalidNumberKeys}
                onChange={(event) => setControlEfectivo(normalizeDecimalInput(event.target.value))}
                placeholder={String(controlPorMedio.efectivo.esperadoAbierto)}
              />
            </label>

            <div className="caja-control-difference">
              <span>Diferencia</span>
              <strong
                className={
                  diferenciaControlEfectivo === null || Math.abs(diferenciaControlEfectivo) <= 0.01
                    ? "amount-positive"
                    : "amount-negative"
                }
              >
                {formatDifference(diferenciaControlEfectivo)}
              </strong>
            </div>
          </article>

          <article className="caja-control-item">
            <div className="caja-control-item__title">
              <FiCreditCard />
              <div>
                <strong>Total Mercado Pago / digital</strong>
                <small>
                  {controlPorMedio.digital.cajasAbiertas} cajas abiertas ·
                  esperado {formatCurrency(controlPorMedio.digital.esperadoAbierto)}
                </small>
              </div>
            </div>

            <label className="form-field">
              <span>Total acreditado</span>
              <input
                type="text"
                inputMode="decimal"
                value={controlDigital}
                onKeyDown={preventInvalidNumberKeys}
                onChange={(event) => setControlDigital(normalizeDecimalInput(event.target.value))}
                placeholder={String(controlPorMedio.digital.esperadoAbierto)}
              />
            </label>

            <div className="caja-control-difference">
              <span>Diferencia</span>
              <strong
                className={
                  diferenciaControlDigital === null || Math.abs(diferenciaControlDigital) <= 0.01
                    ? "amount-positive"
                    : "amount-negative"
                }
              >
                {formatDifference(diferenciaControlDigital)}
              </strong>
            </div>
          </article>
        </div>

        <div className="form-actions caja-control-actions">
          <button
            type="button"
            className="btn btn-ghost"
            onClick={useExpectedGeneralTotals}
          >
            Usar esperados generales
          </button>

          <button
            type="button"
            className="btn btn-primary"
            disabled={cajasAbiertas.length === 0}
            onClick={fillExpectedInOpenClosures}
          >
            Cargar esperados en cierres
          </button>
        </div>
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>Cajas del día</strong>
            <small>
              Cerrá cada caja cuando quieras controlar lo real contra lo esperado.
            </small>
          </div>
        </div>

        {isLoading ? (
          <p className="empty-state">Cargando cajas...</p>
        ) : cajas.length === 0 ? (
          <p className="empty-state">
            Todavía no hay cajas para esta fecha. Se abrirán automáticamente con
            la primera venta o atención.
          </p>
        ) : (
          <div className="caja-grid">
            {cajas.map((caja) => {
              const montoEsperado = roundMoney(caja.monto_esperado);
              const isClosed = caja.estado === "cerrada";

              return (
                <article key={caja.id} className="caja-card">
                  <div className="caja-card__header">
                    <div>
                      <strong>{formatCajaTipo(caja.tipo_caja)}</strong>
                      <small>{getMedioPagoName(caja)}</small>
                    </div>

                    <span className={`caja-status caja-status--${caja.estado}`}>
                      {formatEstadoCaja(caja.estado)}
                    </span>
                  </div>

                  <div className="caja-card__amounts">
                    <div>
                      <span>Inicial</span>
                      <strong>{formatCurrency(caja.monto_inicial)}</strong>
                    </div>

                    <div>
                      <span>Esperado</span>
                      <strong>{formatCurrency(montoEsperado)}</strong>
                    </div>

                    <div>
                      <span>Real</span>
                      <strong>
                        {caja.monto_real === null || caja.monto_real === undefined
                          ? "Sin cerrar"
                          : formatCurrency(caja.monto_real)}
                      </strong>
                    </div>

                    <div>
                      <span>Diferencia</span>
                      <strong>
                        {caja.diferencia === null || caja.diferencia === undefined
                          ? "-"
                          : formatCurrency(caja.diferencia)}
                      </strong>
                    </div>
                  </div>

                  <small>
                    Apertura: {formatDateTime(caja.fecha_apertura)} · Origen: {caja.origen_apertura}
                  </small>

                  {isClosed ? (
                    <div className="caja-closed-box">
                      <FiCheck />
                      Cerrada el {formatDateTime(caja.fecha_cierre)}
                    </div>
                  ) : (
                    <div className="caja-close-box">
                      <label className="form-field">
                        <span>Monto real contado</span>
                        <input
                          type="text"
                          inputMode="decimal"
                          value={cierreValues[caja.id] || ""}
                          onKeyDown={preventInvalidNumberKeys}
                          onChange={(event) => updateCierreValue(caja.id, event.target.value)}
                          placeholder={String(montoEsperado)}
                        />
                      </label>

                      <label className="form-field">
                        <span>Observación de cierre</span>
                        <input
                          type="text"
                          value={cierreObservaciones[caja.id] || ""}
                          onChange={(event) => updateCierreObservacion(caja.id, event.target.value)}
                          placeholder="Opcional"
                        />
                      </label>

                      <div className="form-actions caja-card-actions">
                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => useExpectedAsReal(caja)}
                        >
                          Usar esperado
                        </button>

                        <button
                          type="button"
                          className="btn btn-primary"
                          disabled={isSaving}
                          onClick={() => closeCaja(caja)}
                        >
                          <FiSave />
                          Cerrar caja
                        </button>
                      </div>
                    </div>
                  )}
                </article>
              );
            })}
          </div>
        )}
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>Egreso manual</strong>
            <small>
              Registrá gastos del día, compras chicas o retiros que bajan el
              esperado de la caja seleccionada.
            </small>
          </div>
        </div>

        <form className="caja-expense-form" onSubmit={registerManualExpense}>
          <label className="form-field">
            <span>Caja</span>
            <select
              value={egresoCajaId}
              onChange={(event) => setEgresoCajaId(event.target.value)}
            >
              <option value="">Seleccionar caja abierta</option>
              {cajasAbiertas.map((caja) => (
                <option key={caja.id} value={caja.id}>
                  {formatCajaTipo(caja.tipo_caja)} · {getMedioPagoName(caja)} · {formatCurrency(caja.monto_esperado)}
                </option>
              ))}
            </select>
          </label>

          <label className="form-field">
            <span>Monto</span>
            <input
              type="text"
              inputMode="decimal"
              value={egresoMonto}
              onKeyDown={preventInvalidNumberKeys}
              onChange={(event) => setEgresoMonto(normalizeDecimalInput(event.target.value))}
              placeholder="0"
            />
          </label>

          <label className="form-field">
            <span>Descripción</span>
            <input
              type="text"
              value={egresoDescripcion}
              onChange={(event) => setEgresoDescripcion(event.target.value)}
              placeholder="Ej: Compra de descartables"
            />
          </label>

          <div className="form-field form-field--checkbox">
            <span>Acción</span>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              <FiSave />
              Guardar egreso
            </button>
          </div>
        </form>
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>Movimientos</strong>
            <small>Detalle de ingresos, egresos y ajustes de la fecha elegida.</small>
          </div>
        </div>

        {movimientos.length === 0 ? (
          <p className="empty-state">Todavía no hay movimientos para esta fecha.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Hora</th>
                  <th>Caja</th>
                  <th>Medio</th>
                  <th>Tipo</th>
                  <th>Origen</th>
                  <th>Descripción</th>
                  <th>Monto</th>
                </tr>
              </thead>

              <tbody>
                {movimientos.map((movimiento) => {
                  const sign = getMovimientoSign(movimiento.tipo_movimiento);
                  const signedAmount = Number(movimiento.monto || 0) * sign;

                  return (
                    <tr key={movimiento.id}>
                      <td>{formatDateTime(movimiento.fecha_hora)}</td>
                      <td>{formatCajaTipo(movimiento.tipo_caja)}</td>
                      <td>{getMedioPagoName(movimiento)}</td>
                      <td>{getMovimientoLabel(movimiento)}</td>
                      <td>{getOrigenLabel(movimiento.origen)}</td>
                      <td>{movimiento.descripcion || "-"}</td>
                      <td className={signedAmount < 0 ? "amount-negative" : "amount-positive"}>
                        {formatCurrency(signedAmount)}
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
