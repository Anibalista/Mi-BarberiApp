import { useEffect, useMemo, useState } from "react";
import {
  FiArrowDown,
  FiArrowLeft,
  FiArrowRight,
  FiArrowUp,
  FiCalendar,
  FiCheck,
  FiClock,
  FiPhone,
  FiSave,
  FiScissors,
  FiTrash2,
  FiSearch, FiUserPlus,
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

const emptyPhoneForm = {
  paisTelefono: "+54",
  areaTelefono: "",
  numeroTelefono: "",
};

const countryCodes = [
  { codigo: "+54", nombre: "Argentina" },
  { codigo: "+598", nombre: "Uruguay" },
];

const estadosTurno = ["pendiente", "confirmado", "cancelado", "ausente", "atendido"];

const estadoLabels = {
  pendiente: "Pendiente",
  confirmado: "Confirmado",
  cancelado: "Cancelado",
  ausente: "Ausente",
  atendido: "Atendido",
};

const weekDays = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

function createTempId() {
  return crypto.randomUUID();
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function capitalizeWordsInput(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function normalizeClientNameForSave(value) {
  return capitalizeWordsInput(String(value || "").trim().replace(/\s+/g, " "));
}

function toDateInputValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function toMonthInputDate(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function buildLocalDateTime(dateValue, timeValue) {
  if (!dateValue || !timeValue) return null;

  return new Date(`${dateValue}T${timeValue}:00`);
}

function addMinutes(date, minutes) {
  const result = new Date(date);

  result.setMinutes(result.getMinutes() + Number(minutes || 0));

  return result;
}

function formatTime(dateValue) {
  if (!dateValue) return "Sin hora";

  return new Intl.DateTimeFormat("es-AR", {
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(dateValue));
}

function formatDate(dateValue) {
  if (!dateValue) return "Sin fecha";

  return new Intl.DateTimeFormat("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(dateValue));
}

function formatDateTitle(dateValue) {
  return new Intl.DateTimeFormat("es-AR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(`${dateValue}T00:00:00`));
}

function getMonthName(date) {
  return new Intl.DateTimeFormat("es-AR", {
    month: "long",
    year: "numeric",
  }).format(date);
}

function getCalendarDays(monthDate) {
  const year = monthDate.getFullYear();
  const month = monthDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const firstWeekDay = (firstDay.getDay() + 6) % 7;
  const calendarStart = new Date(year, month, 1 - firstWeekDay);

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(calendarStart);

    date.setDate(calendarStart.getDate() + index);

    return date;
  });
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

function getTurnoClienteNombre(turno) {
  const nombre = `${turno.clientes?.nombre || ""} ${
    turno.clientes?.apellido || ""
  }`.trim();

  return nombre || "Cliente sin nombre";
}

function getTurnoBarberoNombre(turno) {
  return turno.colaboradores?.nombre_publico || "Sin barbero asignado";
}

function getTurnoServicios(turno) {
  return turno.turno_servicios || [];
}

function hasTurnoOverlap({
  candidateStart,
  candidateEnd,
  existingStart,
  existingEnd,
  toleranceMinutes = 5,
}) {
  const candidateStartMs = candidateStart.getTime();
  const candidateEndMs = addMinutes(candidateEnd, -toleranceMinutes).getTime();
  const existingStartMs = existingStart.getTime();
  const existingEndMs = addMinutes(existingEnd, -toleranceMinutes).getTime();

  return candidateStartMs < existingEndMs && candidateEndMs > existingStartMs;
}

export default function NuevoTurnoPage() {
  const { negocio, sucursal, servicios, clientes, refreshAppData } = useAppData();

  const today = useMemo(() => new Date(), []);
  const todayDateValue = toDateInputValue(today);

  const [colaboradores, setColaboradores] = useState([]);
  const [turnos, setTurnos] = useState([]);

  const [monthDate, setMonthDate] = useState(toMonthInputDate(today));
  const [selectedDate, setSelectedDate] = useState(todayDateValue);
  const [viewMode, setViewMode] = useState("dia");


  const [clienteMode, setClienteMode] = useState("existente");
  const [selectedClienteId, setSelectedClienteId] = useState("");
  const [clienteSearch, setClienteSearch] = useState("");
  const [clienteNombre, setClienteNombre] = useState("");
  const [showClientPhone, setShowClientPhone] = useState(false);
  const [phoneForm, setPhoneForm] = useState(emptyPhoneForm);

  const [colaboradorId, setColaboradorId] = useState("");
  const [fechaTurno, setFechaTurno] = useState(todayDateValue);
  const [horaTurno, setHoraTurno] = useState("");
  const [notas, setNotas] = useState("");

  const [serviciosSeleccionados, setServiciosSeleccionados] = useState([]);

  const [search, setSearch] = useState("");
  const [estadoFilter, setEstadoFilter] = useState("todos");
  const [barberoFilter, setBarberoFilter] = useState("todos");
  const [sortConfig, setSortConfig] = useState({
    key: "fecha",
    direction: "asc",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const phonePreview = useMemo(() => buildPhone(phoneForm), [phoneForm]);

  const clientesOrdenados = useMemo(
    () =>
      [...clientes].sort((a, b) =>
        String(a.nombre || "").localeCompare(String(b.nombre || ""), "es")
      ),
    [clientes]
  );

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

  const serviciosActivos = useMemo(
    () =>
      servicios
        .filter((servicio) => servicio.activo)
        .sort((a, b) => a.nombre.localeCompare(b.nombre, "es")),
    [servicios]
  );

  const colaboradoresActivos = useMemo(
    () =>
      colaboradores
        .filter((colaborador) => colaborador.activo && colaborador.es_barbero)
        .sort((a, b) =>
          a.nombre_publico.localeCompare(b.nombre_publico, "es")
        ),
    [colaboradores]
  );

  const duracionTotal = useMemo(
    () =>
      serviciosSeleccionados.reduce(
        (acc, servicio) => acc + Number(servicio.duracion_minutos || 0),
        0
      ),
    [serviciosSeleccionados]
  );

  const horaFinPreview = useMemo(() => {
    const start = buildLocalDateTime(fechaTurno, horaTurno);

    if (!start || duracionTotal <= 0) return "";

    return formatTime(addMinutes(start, duracionTotal));
  }, [fechaTurno, horaTurno, duracionTotal]);

  const selectedDayTurnos = useMemo(
    () =>
      turnos
        .filter((turno) => {
          const turnoDate = toDateInputValue(new Date(turno.fecha_hora_inicio));

          return turnoDate === selectedDate;
        })
        .sort(
          (a, b) =>
            new Date(a.fecha_hora_inicio).getTime() -
            new Date(b.fecha_hora_inicio).getTime()
        ),
    [turnos, selectedDate]
  );

  const filteredHistoricalTurnos = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    const result = turnos.filter((turno) => {
      const clienteNombre = getTurnoClienteNombre(turno);
      const barberoNombre = getTurnoBarberoNombre(turno);
      const serviciosTexto = getTurnoServicios(turno)
        .map((servicio) => servicio.nombre_servicio_snapshot)
        .join(" ");

      const matchesSearch = normalizeText(
        `${clienteNombre} ${barberoNombre} ${serviciosTexto} ${turno.estado}`
      ).includes(normalizedSearch);

      const matchesEstado =
        estadoFilter === "todos" ? true : turno.estado === estadoFilter;

      const matchesBarbero =
        barberoFilter === "todos"
          ? true
          : barberoFilter === "sin_asignar"
            ? !turno.colaborador_id
            : turno.colaborador_id === barberoFilter;

      return matchesSearch && matchesEstado && matchesBarbero;
    });

    return [...result].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "fecha") {
        return (
          (new Date(a.fecha_hora_inicio).getTime() -
            new Date(b.fecha_hora_inicio).getTime()) *
          direction
        );
      }

      if (sortConfig.key === "cliente") {
        return (
          getTurnoClienteNombre(a).localeCompare(getTurnoClienteNombre(b), "es") *
          direction
        );
      }

      if (sortConfig.key === "barbero") {
        return (
          getTurnoBarberoNombre(a).localeCompare(
            getTurnoBarberoNombre(b),
            "es"
          ) * direction
        );
      }

      if (sortConfig.key === "estado") {
        return (
          String(a.estado).localeCompare(String(b.estado), "es") * direction
        );
      }

      return 0;
    });
  }, [turnos, search, estadoFilter, barberoFilter, sortConfig]);

  async function loadInitialData() {
    if (!negocio?.id) return;

    try {
      setIsLoading(true);
      setFeedback("");

      const monthStart = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
      const monthEnd = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 1);

      const [colaboradoresResult, turnosResult] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre_publico", { ascending: true }),

        supabase
          .from("turnos")
          .select(
            `
            *,
            clientes (
              id,
              nombre,
              apellido,
              telefono,
              whatsapp
            ),
            colaboradores (
              id,
              nombre_publico
            ),
            turno_servicios (
              id,
              servicio_id,
              nombre_servicio_snapshot,
              precio_lista,
              precio_efectivo,
              duracion_minutos
            )
          `
          )
          .eq("negocio_id", negocio.id)
          .gte("fecha_hora_inicio", monthStart.toISOString())
          .lt("fecha_hora_inicio", monthEnd.toISOString())
          .order("fecha_hora_inicio", { ascending: true }),
      ]);

      if (colaboradoresResult.error) throw colaboradoresResult.error;
      if (turnosResult.error) throw turnosResult.error;

      setColaboradores(colaboradoresResult.data ?? []);
      setTurnos(turnosResult.data ?? []);
    } catch (error) {
      console.error("Error cargando agenda:", error);
      setFeedback("No se pudo cargar la agenda.");
    } finally {
      setIsLoading(false);
    }
  }

  async function loadHistoricalTurnos() {
    if (!negocio?.id) return;

    try {
      setIsLoading(true);
      setFeedback("");

      const { data, error } = await supabase
        .from("turnos")
        .select(
          `
          *,
          clientes (
            id,
            nombre,
            apellido,
            telefono,
            whatsapp
          ),
          colaboradores (
            id,
            nombre_publico
          ),
          turno_servicios (
            id,
            servicio_id,
            nombre_servicio_snapshot,
            precio_lista,
            precio_efectivo,
            duracion_minutos
          )
        `
        )
        .eq("negocio_id", negocio.id)
        .order("fecha_hora_inicio", { ascending: false });

      if (error) throw error;

      setTurnos(data ?? []);
    } catch (error) {
      console.error("Error cargando turnos históricos:", error);
      setFeedback("No se pudieron cargar los turnos históricos.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (viewMode === "historico") {
      loadHistoricalTurnos();
    } else {
      loadInitialData();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id, monthDate, viewMode]);

  function resetForm() {
    setClienteMode("existente");
    setSelectedClienteId("");
    setClienteSearch("");
    setClienteNombre("");
    setShowClientPhone(false);
    setPhoneForm(emptyPhoneForm);
    setColaboradorId("");
    setFechaTurno(selectedDate || todayDateValue);
    setHoraTurno("");
    setNotas("");
    setServiciosSeleccionados([]);
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

  function addServicio(servicioId) {
    if (!servicioId) return;

    const servicio = serviciosActivos.find((item) => item.id === servicioId);

    if (!servicio) return;

    const alreadySelected = serviciosSeleccionados.some(
      (item) => item.id === servicio.id
    );

    if (alreadySelected) {
      setFeedback("Ese servicio ya está agregado al turno.");
      return;
    }

    setServiciosSeleccionados((current) => [
      ...current,
      {
        tempId: createTempId(),
        id: servicio.id,
        nombre: servicio.nombre,
        precio_lista: Number(servicio.precio_lista || 0),
        precio_efectivo: Number(servicio.precio_efectivo || 0),
        duracion_minutos: Number(servicio.duracion_minutos || 0),
      },
    ]);

    setFeedback("");
  }

  function removeServicio(tempId) {
    setServiciosSeleccionados((current) =>
      current.filter((servicio) => servicio.tempId !== tempId)
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

    const cleanName = normalizeClientNameForSave(clienteNombre);

    const { data, error } = await supabase
      .from("clientes")
      .insert({
        negocio_id: negocio.id,
        nombre: cleanName,
        telefono: phoneResult.value,
        whatsapp: phoneResult.value,
        origen: "turno",
      })
      .select("*")
      .single();

    if (error) throw error;

    return data;
  }

  function validateOverlap(startDateTime, endDateTime) {
    if (!colaboradorId) return "";

    const turnosDelMismoBarbero = turnos.filter((turno) => {
      if (turno.colaborador_id !== colaboradorId) return false;
      if (turno.estado === "cancelado" || turno.estado === "ausente") return false;

      const turnoDate = toDateInputValue(new Date(turno.fecha_hora_inicio));

      return turnoDate === fechaTurno;
    });

    const overlappingTurno = turnosDelMismoBarbero.find((turno) => {
      const existingStart = new Date(turno.fecha_hora_inicio);
      const existingEnd = turno.fecha_hora_fin
        ? new Date(turno.fecha_hora_fin)
        : addMinutes(existingStart, 30);

      return hasTurnoOverlap({
        candidateStart: startDateTime,
        candidateEnd: endDateTime,
        existingStart,
        existingEnd,
        toleranceMinutes: 5,
      });
    });

    if (!overlappingTurno) return "";

    return `Ese barbero ya tiene un turno de ${formatTime(
      overlappingTurno.fecha_hora_inicio
    )} a ${formatTime(
      overlappingTurno.fecha_hora_fin
    )}. Se permite pisar solo los últimos 5 minutos.`;
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

    if (!fechaTurno) {
      return "Seleccioná la fecha del turno.";
    }

    if (!horaTurno) {
      return "Seleccioná la hora del turno.";
    }

    if (serviciosSeleccionados.length === 0) {
      return "Agregá al menos un servicio al turno.";
    }

    if (duracionTotal <= 0) {
      return "Los servicios seleccionados deben tener duración mayor a cero.";
    }

    const startDateTime = buildLocalDateTime(fechaTurno, horaTurno);
    const endDateTime = addMinutes(startDateTime, duracionTotal);

    const overlapError = validateOverlap(startDateTime, endDateTime);

    if (overlapError) {
      return overlapError;
    }

    return "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    const phoneResult = buildPhone(phoneForm);
    const validationError = validateBeforeSave(phoneResult);

    if (validationError) {
      setFeedback(validationError);
      return;
    }

    const startDateTime = buildLocalDateTime(fechaTurno, horaTurno);
    const endDateTime = addMinutes(startDateTime, duracionTotal);

    const barberoNombre =
      colaboradoresActivos.find((barbero) => barbero.id === colaboradorId)
        ?.nombre_publico || "Sin barbero asignado";

    const shouldSave = window.confirm(
      `Vas a crear un turno para ${clienteNombre.trim()} el ${formatDate(
        startDateTime
      )} de ${formatTime(startDateTime)} a ${formatTime(
        endDateTime
      )}.\n\nBarbero: ${barberoNombre}\n\n¿Confirmás el turno?`
    );

    if (!shouldSave) {
      setFeedback("Registro cancelado.");
      return;
    }

    try {
      setIsSaving(true);
      setFeedback("");

      const cliente = await getOrCreateClient(phoneResult);

      const { data: turno, error: turnoError } = await supabase
        .from("turnos")
        .insert({
          negocio_id: negocio.id,
          sucursal_id: sucursal.id,
          cliente_id: cliente.id,
          colaborador_id: colaboradorId || null,
          fecha_hora_inicio: startDateTime.toISOString(),
          fecha_hora_fin: endDateTime.toISOString(),
          estado: "pendiente",
          origen: "manual",
          notas: notas.trim() || null,
        })
        .select("*")
        .single();

      if (turnoError) throw turnoError;

      const turnoServiciosPayload = serviciosSeleccionados.map((servicio) => ({
        negocio_id: negocio.id,
        turno_id: turno.id,
        servicio_id: servicio.id,
        nombre_servicio_snapshot: servicio.nombre,
        precio_lista: servicio.precio_lista,
        precio_efectivo: servicio.precio_efectivo,
        duracion_minutos: servicio.duracion_minutos,
      }));

      const { error: serviciosError } = await supabase
        .from("turno_servicios")
        .insert(turnoServiciosPayload);

      if (serviciosError) throw serviciosError;

      setFeedback("Turno creado correctamente.");
      resetForm();
      await refreshAppData();

      if (viewMode === "historico") {
        await loadHistoricalTurnos();
      } else {
        await loadInitialData();
      }
    } catch (error) {
      console.error("Error creando turno:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        fullError: error,
      });

      setFeedback("No se pudo crear el turno.");
    } finally {
      setIsSaving(false);
    }
  }

  async function updateTurnoEstado(turno, nextEstado) {
    const shouldUpdate = window.confirm(
      `¿Querés cambiar el turno de ${getTurnoClienteNombre(
        turno
      )} a estado "${estadoLabels[nextEstado]}"?`
    );

    if (!shouldUpdate) return;

    try {
      setFeedback("");

      const { error } = await supabase
        .from("turnos")
        .update({ estado: nextEstado })
        .eq("id", turno.id)
        .eq("negocio_id", negocio.id);

      if (error) throw error;

      if (viewMode === "historico") {
        await loadHistoricalTurnos();
      } else {
        await loadInitialData();
      }

      await refreshAppData();
    } catch (error) {
      console.error("Error actualizando turno:", error);
      setFeedback("No se pudo actualizar el turno.");
    }
  }

  function goToPreviousMonth() {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() - 1, 1));
  }

  function goToNextMonth() {
    setMonthDate((current) => new Date(current.getFullYear(), current.getMonth() + 1, 1));
  }

  function selectCalendarDay(day) {
    const dateValue = toDateInputValue(day);

    setSelectedDate(dateValue);
    setFechaTurno(dateValue);
    setViewMode("dia");
  }

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

  function renderTurnoCard(turno) {
    const serviciosTurno = getTurnoServicios(turno);

    return (
      <article key={turno.id} className="turno-card">
        <div className="turno-card__time">
          <strong>{formatTime(turno.fecha_hora_inicio)}</strong>
          <small>{formatTime(turno.fecha_hora_fin)}</small>
        </div>

        <div className="turno-card__main">
          <strong>{getTurnoClienteNombre(turno)}</strong>
          <small>
            {turno.clientes?.telefono ||
              turno.clientes?.whatsapp ||
              "Sin teléfono"}{" "}
            · {getTurnoBarberoNombre(turno)}
          </small>

          <div className="turno-services">
            {serviciosTurno.length === 0 ? (
              <span>Sin servicios</span>
            ) : (
              serviciosTurno.map((servicio) => (
                <span key={servicio.id}>
                  <FiScissors />
                  {servicio.nombre_servicio_snapshot}
                </span>
              ))
            )}
          </div>

          {turno.notas && <p>{turno.notas}</p>}
        </div>

        <div className="turno-card__status">
          <span className={`turno-status turno-status--${turno.estado}`}>
            {estadoLabels[turno.estado] || turno.estado}
          </span>
        </div>

        <div className="turno-card__actions">
          {turno.estado === "pendiente" && (
            <button
              type="button"
              className="icon-button"
              onClick={() => updateTurnoEstado(turno, "confirmado")}
              title="Confirmar"
            >
              <FiCheck />
            </button>
          )}

          {turno.estado !== "cancelado" && turno.estado !== "atendido" && (
            <>
              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => updateTurnoEstado(turno, "atendido")}
              >
                Atendido
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => updateTurnoEstado(turno, "ausente")}
              >
                Ausente
              </button>

              <button
                type="button"
                className="btn btn-ghost btn-small"
                onClick={() => updateTurnoEstado(turno, "cancelado")}
              >
                Cancelar
              </button>
            </>
          )}
        </div>
      </article>
    );
  }

  const calendarDays = getCalendarDays(monthDate);

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Agenda</span>
        <h2>Nuevo turno</h2>
        <p>
          Creá turnos con cliente, servicios, fecha, hora y barbero opcional. Si
          el barbero está asignado, se evita cruce horario salvo los últimos 5
          minutos.
        </p>
      </section>

      <section className="work-card agenda-form-card">
        <div className="toolbar">
          <div>
            <strong>Crear turno</strong>
            <small>
              El barbero puede quedar sin asignar para que atienda quien esté
              libre.
            </small>
          </div>

          <button type="button" className="btn btn-ghost" onClick={resetForm}>
            <FiX />
            Limpiar
          </button>
        </div>

        <form className="agenda-form" onSubmit={handleSubmit}>
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
              <span>Barbero</span>
              <select
                value={colaboradorId}
                onChange={(event) => setColaboradorId(event.target.value)}
              >
                <option value="">Sin asignar / quien esté libre</option>
                {colaboradoresActivos.map((barbero) => (
                  <option key={barbero.id} value={barbero.id}>
                    {barbero.nombre_publico}
                  </option>
                ))}
              </select>
            </label>

            <label className="form-field">
              <span>Fecha</span>
              <input
                type="date"
                value={fechaTurno}
                onChange={(event) => {
                  setFechaTurno(event.target.value);
                  setSelectedDate(event.target.value);
                }}
                required
              />
            </label>

            <label className="form-field">
              <span>Hora inicio</span>
              <input
                type="time"
                value={horaTurno}
                onChange={(event) => setHoraTurno(event.target.value)}
                required
              />
            </label>

            <label className="form-field">
              <span>Hora fin estimada</span>
              <input
                type="text"
                value={horaFinPreview || "Agregá servicios"}
                readOnly
              />
            </label>
          </div>

          <button
            type="button"
            className={`status-switch ${showClientPhone ? "is-active" : ""}`}
            onClick={() => setShowClientPhone((current) => !current)}
          >
            <FiPhone />
            {showClientPhone ? "Ocultar teléfono" : "Agregar teléfono"}
          </button>

          {showClientPhone && (
            <div className="phone-box">
              <div>
                <strong>Teléfono / WhatsApp</strong>
                <small>
                  Opcional. Si el cliente no existe se guarda con el alta rápida.
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

          <div className="costs-box">
            <div className="toolbar">
              <div>
                <strong>Servicios del turno</strong>
                <small>
                  La duración total define la hora fin y la validación de cruces.
                </small>
              </div>

              <label className="form-field agenda-service-picker">
                <span>Agregar servicio</span>
                <select
                  defaultValue=""
                  onChange={(event) => {
                    addServicio(event.target.value);
                    event.target.value = "";
                  }}
                >
                  <option value="">Seleccionar servicio</option>
                  {serviciosActivos.map((servicio) => (
                    <option key={servicio.id} value={servicio.id}>
                      {servicio.nombre} · {servicio.duracion_minutos || 0} min
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {serviciosSeleccionados.length === 0 ? (
              <p className="empty-state">Todavía no agregaste servicios.</p>
            ) : (
              <div className="turno-services-selected">
                {serviciosSeleccionados.map((servicio) => (
                  <article key={servicio.tempId} className="line-item">
                    <div>
                      <strong>{servicio.nombre}</strong>
                      <small>{servicio.duracion_minutos || 0} minutos</small>
                    </div>

                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => removeServicio(servicio.tempId)}
                      aria-label="Quitar servicio"
                    >
                      <FiTrash2 />
                    </button>
                  </article>
                ))}
              </div>
            )}

            <div className="total-bar">
              <span>Duración total</span>
              <strong>{duracionTotal} min</strong>
            </div>
          </div>

          <label className="form-field">
            <span>Notas</span>
            <textarea
              rows="3"
              value={notas}
              onChange={(event) =>
                setNotas(capitalizeFirstLetter(event.target.value))
              }
              placeholder="Opcional"
            />
          </label>

          {feedback && <p className="form-feedback">{feedback}</p>}

          <div className="form-actions">
            <button type="button" className="btn btn-ghost" onClick={resetForm}>
              <FiX />
              Cancelar
            </button>

            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              <FiSave />
              {isSaving ? "Guardando..." : "Guardar turno"}
            </button>
          </div>
        </form>
      </section>

      <section className="work-card agenda-card">
        <div className="toolbar">
          <div>
            <strong>Agenda</strong>
            <small>
              Calendario mensual con turnos por día y listado del día
              seleccionado.
            </small>
          </div>

          <div className="toolbar-actions">
            <button
              type="button"
              className={`btn btn-ghost ${viewMode === "dia" ? "is-active" : ""}`}
              onClick={() => setViewMode("dia")}
            >
              <FiCalendar />
              Día
            </button>

            <button
              type="button"
              className={`btn btn-ghost ${
                viewMode === "historico" ? "is-active" : ""
              }`}
              onClick={() => setViewMode("historico")}
            >
              <FiClock />
              Históricos
            </button>
          </div>
        </div>

        {viewMode === "dia" ? (
          <>
            <div className="calendar-header">
              <button type="button" className="icon-button" onClick={goToPreviousMonth}>
                <FiArrowLeft />
              </button>

              <strong>{getMonthName(monthDate)}</strong>

              <button type="button" className="icon-button" onClick={goToNextMonth}>
                <FiArrowRight />
              </button>
            </div>

            <div className="calendar-grid">
              {weekDays.map((dayName) => (
                <div key={dayName} className="calendar-weekday">
                  {dayName}
                </div>
              ))}

              {calendarDays.map((day) => {
                const dateValue = toDateInputValue(day);
                const dayTurnos = turnos.filter(
                  (turno) =>
                    toDateInputValue(new Date(turno.fecha_hora_inicio)) === dateValue
                );

                const isCurrentMonth = day.getMonth() === monthDate.getMonth();
                const isSelected = dateValue === selectedDate;
                const hasTurnos = dayTurnos.length > 0;

                return (
                  <button
                    key={dateValue}
                    type="button"
                    className={`calendar-day ${
                      isCurrentMonth ? "" : "is-muted"
                    } ${isSelected ? "is-selected" : ""} ${
                      hasTurnos ? "has-turnos" : ""
                    }`}
                    onClick={() => selectCalendarDay(day)}
                  >
                    <strong>{day.getDate()}</strong>

                    {hasTurnos && (
                      <span>
                        {dayTurnos.length} turno
                        {dayTurnos.length === 1 ? "" : "s"}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="day-turnos-panel">
              <div className="toolbar">
                <div>
                  <strong>Turnos del día</strong>
                  <small>{formatDateTitle(selectedDate)}</small>
                </div>
              </div>

              {isLoading ? (
                <p className="empty-state">Cargando turnos...</p>
              ) : selectedDayTurnos.length === 0 ? (
                <p className="empty-state">No hay turnos para este día.</p>
              ) : (
                <div className="turnos-list">
                  {selectedDayTurnos.map((turno) => renderTurnoCard(turno))}
                </div>
              )}
            </div>
          </>
        ) : (
          <>
            <div className="toolbar-actions historical-filters">
              <label className="search-box">
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Buscar turno..."
                />
              </label>

              <select
                className="toolbar-select"
                value={estadoFilter}
                onChange={(event) => setEstadoFilter(event.target.value)}
              >
                <option value="todos">Todos los estados</option>
                {estadosTurno.map((estado) => (
                  <option key={estado} value={estado}>
                    {estadoLabels[estado]}
                  </option>
                ))}
              </select>

              <select
                className="toolbar-select"
                value={barberoFilter}
                onChange={(event) => setBarberoFilter(event.target.value)}
              >
                <option value="todos">Todos los barberos</option>
                <option value="sin_asignar">Sin asignar</option>
                {colaboradoresActivos.map((barbero) => (
                  <option key={barbero.id} value={barbero.id}>
                    {barbero.nombre_publico}
                  </option>
                ))}
              </select>
            </div>

            <div className="table-wrapper">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>
                      <button type="button" onClick={() => updateSort("fecha")}>
                        Fecha <SortIcon columnKey="fecha" />
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => updateSort("cliente")}>
                        Cliente <SortIcon columnKey="cliente" />
                      </button>
                    </th>
                    <th>
                      <button type="button" onClick={() => updateSort("barbero")}>
                        Barbero <SortIcon columnKey="barbero" />
                      </button>
                    </th>
                    <th>Servicios</th>
                    <th>
                      <button type="button" onClick={() => updateSort("estado")}>
                        Estado <SortIcon columnKey="estado" />
                      </button>
                    </th>
                    <th>Acciones</th>
                  </tr>
                </thead>

                <tbody>
                  {filteredHistoricalTurnos.map((turno) => (
                    <tr key={turno.id}>
                      <td>
                        <strong>{formatDate(turno.fecha_hora_inicio)}</strong>
                        <small>
                          {formatTime(turno.fecha_hora_inicio)} -{" "}
                          {formatTime(turno.fecha_hora_fin)}
                        </small>
                      </td>

                      <td>
                        <strong>{getTurnoClienteNombre(turno)}</strong>
                        <small>
                          {turno.clientes?.telefono ||
                            turno.clientes?.whatsapp ||
                            "Sin teléfono"}
                        </small>
                      </td>

                      <td>{getTurnoBarberoNombre(turno)}</td>

                      <td>
                        {getTurnoServicios(turno).map((servicio) => (
                          <small key={servicio.id}>
                            {servicio.nombre_servicio_snapshot}
                          </small>
                        ))}
                      </td>

                      <td>
                        <span className={`turno-status turno-status--${turno.estado}`}>
                          {estadoLabels[turno.estado] || turno.estado}
                        </span>
                      </td>

                      <td>{renderTurnoCard(turno).props.children[3]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>
    </PageShell>
  );
}