import { useEffect, useMemo, useState } from "react";
import {
  FiBriefcase,
  FiDollarSign,
  FiEdit2,
  FiPercent,
  FiRefreshCw,
  FiSave,
  FiSearch,
  FiUser,
  FiSliders,
  FiUserCheck,
  FiUsers,
  FiX,
} from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";
import { supabase } from "../lib/supabaseClient";
import { preventInvalidNumberKeys } from "../utils/formGuards";
import { formatCurrency } from "../utils/formatters";

const FRECUENCIAS = [
  { value: "diaria", label: "Diaria" },
  { value: "semanal", label: "Semanal" },
  { value: "quincenal", label: "Quincenal" },
  { value: "mensual", label: "Mensual" },
  { value: "manual", label: "Manual" },
];

const emptyBarberoForm = {
  nombre_publico: "",
  categoria_id: "",
  commission_mode: "heredada",
  porcentaje_comision_default: "",
  frecuencia_pago_default: "",
  es_barbero: true,
  es_propietario: false,
  activo: true,
};

const emptyCategoriaForm = {
  nombre: "",
  descripcion: "",
  commission_mode: "sin_configurar",
  porcentaje_comision_default: "",
  frecuencia_pago_default: "manual",
  activa: true,
};

function getTodayDate() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Argentina/Buenos_Aires",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const emptyReglaForm = {
  alcance: "barbero",
  objetivo_id: "",
  servicio_id: "",
  valor_tipo: "porcentaje",
  valor: "",
  vigencia_desde: getTodayDate(),
  vigencia_hasta: "",
  frecuencia_pago: "manual",
  activa: true,
};

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

function capitalizeWords(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function capitalizeFirst(value) {
  const text = String(value || "");
  return text ? text.charAt(0).toUpperCase() + text.slice(1) : "";
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

function numberFromInput(value) {
  return Number(String(value || "0").replace(",", "."));
}

function hasConfiguredNumber(value) {
  return value !== null && value !== undefined && value !== "";
}

function formatPercent(value) {
  if (!hasConfiguredNumber(value)) return "Sin configurar";

  return `${Number(value).toLocaleString("es-AR", {
    maximumFractionDigits: 2,
  })}%`;
}

function getFrequencyLabel(value) {
  return (
    FRECUENCIAS.find((frecuencia) => frecuencia.value === value)?.label ||
    "Manual"
  );
}

function getErrorMessage(error, entityName) {
  if (error?.code === "23505") {
    return `Ya existe ${entityName} con ese nombre.`;
  }

  return error?.message || `No se pudo guardar ${entityName}.`;
}

function dateRangesOverlap(startA, endA, startB, endB) {
  const normalizedEndA = endA || "9999-12-31";
  const normalizedEndB = endB || "9999-12-31";

  return startA <= normalizedEndB && startB <= normalizedEndA;
}

function getRuleStatus(rule, today = getTodayDate()) {
  if (!rule.activa) {
    return { label: "Inactiva", className: "is-inactive" };
  }

  if (rule.vigencia_desde > today) {
    return { label: "Próxima", className: "is-upcoming" };
  }

  if (rule.vigencia_hasta && rule.vigencia_hasta < today) {
    return { label: "Vencida", className: "is-expired" };
  }

  return { label: "Vigente", className: "is-active" };
}

export default function BarberosPage() {
  const { negocio, servicios, refreshAppData } = useAppData();

  const [activeTab, setActiveTab] = useState("barberos");
  const [barberos, setBarberos] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [reglas, setReglas] = useState([]);

  const [barberoSearch, setBarberoSearch] = useState("");
  const [showInactiveBarberos, setShowInactiveBarberos] = useState(false);
  const [showInactiveCategories, setShowInactiveCategories] = useState(false);
  const [reglaSearch, setReglaSearch] = useState("");
  const [showInactiveRules, setShowInactiveRules] = useState(false);

  const [barberoForm, setBarberoForm] = useState(emptyBarberoForm);
  const [categoriaForm, setCategoriaForm] = useState(emptyCategoriaForm);
  const [reglaForm, setReglaForm] = useState(emptyReglaForm);
  const [editingBarberoId, setEditingBarberoId] = useState(null);
  const [editingCategoriaId, setEditingCategoriaId] = useState(null);
  const [editingReglaId, setEditingReglaId] = useState(null);

  const [isLoading, setIsLoading] = useState(true);
  const [isSavingBarbero, setIsSavingBarbero] = useState(false);
  const [isSavingCategoria, setIsSavingCategoria] = useState(false);
  const [isSavingRegla, setIsSavingRegla] = useState(false);
  const [feedback, setFeedback] = useState(null);

  async function loadManagementData({ silent = false } = {}) {
    if (!negocio?.id) return;

    try {
      if (!silent) {
        setIsLoading(true);
        setFeedback(null);
      }

      const [barberosResult, categoriasResult, reglasResult] = await Promise.all([
        supabase
          .from("colaboradores")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre_publico", { ascending: true }),

        supabase
          .from("categorias_colaborador")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("nombre", { ascending: true }),

        supabase
          .from("reglas_comision")
          .select("*")
          .eq("negocio_id", negocio.id)
          .order("vigencia_desde", { ascending: false }),
      ]);

      if (barberosResult.error) throw barberosResult.error;
      if (categoriasResult.error) throw categoriasResult.error;
      if (reglasResult.error) throw reglasResult.error;

      setBarberos(barberosResult.data ?? []);
      setCategorias(categoriasResult.data ?? []);
      setReglas(reglasResult.data ?? []);
    } catch (error) {
      console.error("Error cargando gestión de barberos:", error);
      setFeedback({
        type: "error",
        message: "No se pudieron cargar los barberos y puestos.",
      });
    } finally {
      if (!silent) setIsLoading(false);
    }
  }

  useEffect(() => {
    loadManagementData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id]);

  const categoriaById = useMemo(
    () => new Map(categorias.map((categoria) => [categoria.id, categoria])),
    [categorias]
  );

  const barberoById = useMemo(
    () => new Map(barberos.map((barbero) => [barbero.id, barbero])),
    [barberos]
  );

  const servicioById = useMemo(
    () => new Map(servicios.map((servicio) => [servicio.id, servicio])),
    [servicios]
  );

  const barberosFiltrados = useMemo(() => {
    const search = normalizeText(barberoSearch);

    return [...barberos]
      .filter((barbero) => showInactiveBarberos || barbero.activo)
      .filter((barbero) => {
        if (!search) return true;

        const categoria = categoriaById.get(barbero.categoria_id);

        return normalizeText(
          `${barbero.nombre_publico} ${categoria?.nombre || ""}`
        ).includes(search);
      })
      .sort((a, b) => {
        if (a.activo !== b.activo) return a.activo ? -1 : 1;

        return String(a.nombre_publico || "").localeCompare(
          String(b.nombre_publico || ""),
          "es"
        );
      });
  }, [
    barberos,
    barberoSearch,
    categoriaById,
    showInactiveBarberos,
  ]);

  const categoriasFiltradas = useMemo(
    () =>
      [...categorias]
        .filter((categoria) => showInactiveCategories || categoria.activa)
        .sort((a, b) => {
          if (a.activa !== b.activa) return a.activa ? -1 : 1;
          return String(a.nombre || "").localeCompare(
            String(b.nombre || ""),
            "es"
          );
        }),
    [categorias, showInactiveCategories]
  );

  const reglasFiltradas = useMemo(() => {
    const search = normalizeText(reglaSearch);

    return [...reglas]
      .filter((regla) => showInactiveRules || regla.activa)
      .filter((regla) => {
        if (!search) return true;

        const barbero = barberoById.get(regla.colaborador_id);
        const categoria = categoriaById.get(regla.categoria_id);
        const servicio = servicioById.get(regla.servicio_id);

        return normalizeText(
          `${barbero?.nombre_publico || ""} ${categoria?.nombre || ""} ${
            servicio?.nombre || ""
          }`
        ).includes(search);
      })
      .sort((a, b) => {
        const statusA = getRuleStatus(a);
        const statusB = getRuleStatus(b);

        if (statusA.label === "Vigente" && statusB.label !== "Vigente") return -1;
        if (statusA.label !== "Vigente" && statusB.label === "Vigente") return 1;

        return String(b.vigencia_desde || "").localeCompare(
          String(a.vigencia_desde || "")
        );
      });
  }, [
    reglas,
    reglaSearch,
    showInactiveRules,
    barberoById,
    categoriaById,
    servicioById,
  ]);

  const summary = useMemo(
    () => ({
      barberosActivos: barberos.filter(
        (barbero) => barbero.activo && barbero.es_barbero
      ).length,
      propietariosActivos: barberos.filter(
        (barbero) => barbero.activo && barbero.es_propietario
      ).length,
      puestosActivos: categorias.filter((categoria) => categoria.activa).length,
      personalizados: barberos.filter((barbero) =>
        hasConfiguredNumber(barbero.porcentaje_comision_default)
      ).length,
    }),
    [barberos, categorias]
  );

  function resetBarberoForm() {
    setEditingBarberoId(null);
    setBarberoForm(emptyBarberoForm);
  }

  function resetCategoriaForm() {
    setEditingCategoriaId(null);
    setCategoriaForm(emptyCategoriaForm);
  }

  function resetReglaForm() {
    setEditingReglaId(null);
    setReglaForm({
      ...emptyReglaForm,
      vigencia_desde: getTodayDate(),
    });
  }

  function startEditBarbero(barbero) {
    setActiveTab("barberos");
    setEditingBarberoId(barbero.id);
    setBarberoForm({
      nombre_publico: barbero.nombre_publico || "",
      categoria_id: barbero.categoria_id || "",
      commission_mode: hasConfiguredNumber(
        barbero.porcentaje_comision_default
      )
        ? "personalizada"
        : "heredada",
      porcentaje_comision_default: hasConfiguredNumber(
        barbero.porcentaje_comision_default
      )
        ? String(barbero.porcentaje_comision_default)
        : "",
      frecuencia_pago_default: barbero.frecuencia_pago_default || "",
      es_barbero: Boolean(barbero.es_barbero),
      es_propietario: Boolean(barbero.es_propietario),
      activo: Boolean(barbero.activo),
    });
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditCategoria(categoria) {
    setActiveTab("puestos");
    setEditingCategoriaId(categoria.id);
    setCategoriaForm({
      nombre: categoria.nombre || "",
      descripcion: categoria.descripcion || "",
      commission_mode: hasConfiguredNumber(
        categoria.porcentaje_comision_default
      )
        ? "personalizada"
        : "sin_configurar",
      porcentaje_comision_default: hasConfiguredNumber(
        categoria.porcentaje_comision_default
      )
        ? String(categoria.porcentaje_comision_default)
        : "",
      frecuencia_pago_default:
        categoria.frecuencia_pago_default || "manual",
      activa: Boolean(categoria.activa),
    });
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function startEditRegla(regla) {
    let alcance = "servicio";
    let objetivoId = "";

    if (regla.colaborador_id) {
      alcance = "barbero";
      objetivoId = regla.colaborador_id;
    } else if (regla.categoria_id) {
      alcance = "categoria";
      objetivoId = regla.categoria_id;
    }

    setActiveTab("reglas");
    setEditingReglaId(regla.id);
    setReglaForm({
      alcance,
      objetivo_id: objetivoId,
      servicio_id: regla.servicio_id || "",
      valor_tipo:
        regla.porcentaje !== null && regla.porcentaje !== undefined
          ? "porcentaje"
          : "monto_fijo",
      valor:
        regla.porcentaje !== null && regla.porcentaje !== undefined
          ? String(regla.porcentaje)
          : String(regla.monto_fijo || ""),
      vigencia_desde: regla.vigencia_desde || getTodayDate(),
      vigencia_hasta: regla.vigencia_hasta || "",
      frecuencia_pago: regla.frecuencia_pago || "manual",
      activa: Boolean(regla.activa),
    });
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function validatePercentage(mode, value, inheritedLabel) {
    if (mode !== "personalizada") return "";

    if (String(value).trim() === "") {
      return `Ingresá el porcentaje de comisión ${inheritedLabel}.`;
    }

    const percentage = numberFromInput(value);

    if (!Number.isFinite(percentage) || percentage < 0 || percentage > 100) {
      return "El porcentaje debe estar entre 0 y 100.";
    }

    return "";
  }

  async function saveBarbero(event) {
    event.preventDefault();

    if (!negocio?.id) {
      setFeedback({
        type: "error",
        message: "No se encontró el negocio actual.",
      });
      return;
    }

    const normalizedName = capitalizeWords(
      barberoForm.nombre_publico.trim().replace(/\s+/g, " ")
    );

    if (!normalizedName) {
      setFeedback({
        type: "error",
        message: "Ingresá el nombre público del barbero o colaborador.",
      });
      return;
    }

    const percentageError = validatePercentage(
      barberoForm.commission_mode,
      barberoForm.porcentaje_comision_default,
      "personalizada"
    );

    if (percentageError) {
      setFeedback({ type: "error", message: percentageError });
      return;
    }

    const payload = {
      negocio_id: negocio.id,
      nombre_publico: normalizedName,
      categoria_id: barberoForm.categoria_id || null,
      porcentaje_comision_default:
        barberoForm.commission_mode === "personalizada"
          ? numberFromInput(barberoForm.porcentaje_comision_default)
          : null,
      frecuencia_pago_default:
        barberoForm.frecuencia_pago_default || null,
      es_barbero: barberoForm.es_barbero,
      es_propietario: barberoForm.es_propietario,
      activo: barberoForm.activo,
    };

    try {
      setIsSavingBarbero(true);
      setFeedback(null);

      const query = editingBarberoId
        ? supabase
            .from("colaboradores")
            .update(payload)
            .eq("id", editingBarberoId)
            .eq("negocio_id", negocio.id)
        : supabase.from("colaboradores").insert(payload);

      const { error } = await query;

      if (error) throw error;

      setFeedback({
        type: "success",
        message: editingBarberoId
          ? "Barbero actualizado correctamente."
          : "Barbero agregado correctamente.",
      });

      resetBarberoForm();
      await Promise.all([
        loadManagementData({ silent: true }),
        refreshAppData(),
      ]);
    } catch (error) {
      console.error("Error guardando barbero:", error);
      setFeedback({
        type: "error",
        message: getErrorMessage(error, "un colaborador"),
      });
    } finally {
      setIsSavingBarbero(false);
    }
  }

  async function saveCategoria(event) {
    event.preventDefault();

    if (!negocio?.id) {
      setFeedback({
        type: "error",
        message: "No se encontró el negocio actual.",
      });
      return;
    }

    const normalizedName = capitalizeWords(
      categoriaForm.nombre.trim().replace(/\s+/g, " ")
    );

    if (!normalizedName) {
      setFeedback({
        type: "error",
        message: "Ingresá el nombre del puesto.",
      });
      return;
    }

    const percentageError = validatePercentage(
      categoriaForm.commission_mode,
      categoriaForm.porcentaje_comision_default,
      "del puesto"
    );

    if (percentageError) {
      setFeedback({ type: "error", message: percentageError });
      return;
    }

    const payload = {
      negocio_id: negocio.id,
      nombre: normalizedName,
      descripcion: categoriaForm.descripcion.trim() || null,
      porcentaje_comision_default:
        categoriaForm.commission_mode === "personalizada"
          ? numberFromInput(categoriaForm.porcentaje_comision_default)
          : null,
      frecuencia_pago_default:
        categoriaForm.frecuencia_pago_default || "manual",
      activa: categoriaForm.activa,
    };

    try {
      setIsSavingCategoria(true);
      setFeedback(null);

      const query = editingCategoriaId
        ? supabase
            .from("categorias_colaborador")
            .update(payload)
            .eq("id", editingCategoriaId)
            .eq("negocio_id", negocio.id)
        : supabase.from("categorias_colaborador").insert(payload);

      const { error } = await query;

      if (error) throw error;

      setFeedback({
        type: "success",
        message: editingCategoriaId
          ? "Puesto actualizado correctamente."
          : "Puesto agregado correctamente.",
      });

      resetCategoriaForm();
      await loadManagementData({ silent: true });
    } catch (error) {
      console.error("Error guardando puesto:", error);
      setFeedback({
        type: "error",
        message: getErrorMessage(error, "un puesto"),
      });
    } finally {
      setIsSavingCategoria(false);
    }
  }

  async function saveRegla(event) {
    event.preventDefault();

    if (!negocio?.id) {
      setFeedback({
        type: "error",
        message: "No se encontró el negocio actual.",
      });
      return;
    }

    if (
      reglaForm.alcance !== "servicio" &&
      !reglaForm.objetivo_id
    ) {
      setFeedback({
        type: "error",
        message:
          reglaForm.alcance === "barbero"
            ? "Seleccioná el barbero al que se aplica la regla."
            : "Seleccioná el puesto al que se aplica la regla.",
      });
      return;
    }

    if (reglaForm.alcance === "servicio" && !reglaForm.servicio_id) {
      setFeedback({
        type: "error",
        message: "Seleccioná el servicio para la regla general.",
      });
      return;
    }

    if (!String(reglaForm.valor).trim()) {
      setFeedback({
        type: "error",
        message: "Ingresá el porcentaje o monto fijo de la comisión.",
      });
      return;
    }

    const value = numberFromInput(reglaForm.valor);

    if (!Number.isFinite(value) || value < 0) {
      setFeedback({
        type: "error",
        message: "El valor de la comisión no puede ser negativo.",
      });
      return;
    }

    if (reglaForm.valor_tipo === "porcentaje" && value > 100) {
      setFeedback({
        type: "error",
        message: "El porcentaje debe estar entre 0 y 100.",
      });
      return;
    }

    if (!reglaForm.vigencia_desde) {
      setFeedback({
        type: "error",
        message: "Ingresá la fecha desde la que rige la comisión.",
      });
      return;
    }

    if (
      reglaForm.vigencia_hasta &&
      reglaForm.vigencia_hasta < reglaForm.vigencia_desde
    ) {
      setFeedback({
        type: "error",
        message: "La fecha de finalización no puede ser anterior al inicio.",
      });
      return;
    }

    const colaboradorId =
      reglaForm.alcance === "barbero" ? reglaForm.objetivo_id : null;
    const categoriaId =
      reglaForm.alcance === "categoria" ? reglaForm.objetivo_id : null;
    const servicioId = reglaForm.servicio_id || null;

    const overlappingRule = reglas.find((regla) => {
      if (regla.id === editingReglaId || !regla.activa || !reglaForm.activa) {
        return false;
      }

      const sameDestination =
        (regla.colaborador_id || null) === colaboradorId &&
        (regla.categoria_id || null) === categoriaId &&
        (regla.servicio_id || null) === servicioId;

      return (
        sameDestination &&
        dateRangesOverlap(
          reglaForm.vigencia_desde,
          reglaForm.vigencia_hasta,
          regla.vigencia_desde,
          regla.vigencia_hasta
        )
      );
    });

    if (overlappingRule) {
      setFeedback({
        type: "error",
        message:
          "Ya existe una regla activa para el mismo destino y servicio dentro de ese período.",
      });
      return;
    }

    const payload = {
      negocio_id: negocio.id,
      colaborador_id: colaboradorId,
      categoria_id: categoriaId,
      servicio_id: servicioId,
      porcentaje:
        reglaForm.valor_tipo === "porcentaje" ? value : null,
      monto_fijo:
        reglaForm.valor_tipo === "monto_fijo" ? value : null,
      vigencia_desde: reglaForm.vigencia_desde,
      vigencia_hasta: reglaForm.vigencia_hasta || null,
      frecuencia_pago: reglaForm.frecuencia_pago || "manual",
      activa: reglaForm.activa,
    };

    try {
      setIsSavingRegla(true);
      setFeedback(null);

      const query = editingReglaId
        ? supabase
            .from("reglas_comision")
            .update(payload)
            .eq("id", editingReglaId)
            .eq("negocio_id", negocio.id)
        : supabase.from("reglas_comision").insert(payload);

      const { error } = await query;

      if (error) throw error;

      setFeedback({
        type: "success",
        message: editingReglaId
          ? "Regla de comisión actualizada correctamente."
          : "Regla de comisión creada correctamente.",
      });

      resetReglaForm();
      await loadManagementData({ silent: true });
    } catch (error) {
      console.error("Error guardando regla de comisión:", error);
      setFeedback({
        type: "error",
        message: error?.message || "No se pudo guardar la regla de comisión.",
      });
    } finally {
      setIsSavingRegla(false);
    }
  }

  function getRuleDestination(rule) {
    if (rule.colaborador_id) {
      return {
        type: "Barbero",
        name:
          barberoById.get(rule.colaborador_id)?.nombre_publico ||
          "Barbero no disponible",
      };
    }

    if (rule.categoria_id) {
      return {
        type: "Puesto",
        name:
          categoriaById.get(rule.categoria_id)?.nombre ||
          "Puesto no disponible",
      };
    }

    return {
      type: "Servicio general",
      name:
        servicioById.get(rule.servicio_id)?.nombre ||
        "Servicio no disponible",
    };
  }

  function getRuleServiceLabel(rule) {
    if (!rule.servicio_id) return "Todos los servicios";

    return (
      servicioById.get(rule.servicio_id)?.nombre ||
      "Servicio no disponible"
    );
  }

  function getRuleValueLabel(rule) {
    if (rule.porcentaje !== null && rule.porcentaje !== undefined) {
      return formatPercent(rule.porcentaje);
    }

    return formatCurrency(Number(rule.monto_fijo || 0));
  }

  function getBarberoCommissionInfo(barbero) {
    const categoria = categoriaById.get(barbero.categoria_id);

    if (hasConfiguredNumber(barbero.porcentaje_comision_default)) {
      return {
        label: formatPercent(barbero.porcentaje_comision_default),
        source: "Personalizada del barbero",
      };
    }

    if (
      categoria &&
      hasConfiguredNumber(categoria.porcentaje_comision_default)
    ) {
      return {
        label: formatPercent(categoria.porcentaje_comision_default),
        source: `Heredada de ${categoria.nombre}`,
      };
    }

    return {
      label: "Según servicio",
      source: "Sin comisión base configurada",
    };
  }

  function getBarberoFrequencyInfo(barbero) {
    if (barbero.frecuencia_pago_default) {
      return {
        label: getFrequencyLabel(barbero.frecuencia_pago_default),
        source: "Personalizada",
      };
    }

    const categoria = categoriaById.get(barbero.categoria_id);

    if (categoria?.frecuencia_pago_default) {
      return {
        label: getFrequencyLabel(categoria.frecuencia_pago_default),
        source: `Heredada de ${categoria.nombre}`,
      };
    }

    return {
      label: "Manual",
      source: "Valor de respaldo",
    };
  }

  function countRulesForBarbero(barberoId) {
    return reglas.filter(
      (regla) => regla.activa && regla.colaborador_id === barberoId
    ).length;
  }

  function countRulesForCategoria(categoriaId) {
    return reglas.filter(
      (regla) => regla.activa && regla.categoria_id === categoriaId
    ).length;
  }

  function countMembersForCategoria(categoriaId) {
    return barberos.filter(
      (barbero) => barbero.categoria_id === categoriaId
    ).length;
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Equipo y comisiones</span>
        <h2>Barberos y puestos</h2>
        <p>
          Administrá el equipo, los puestos y las comisiones base. Las reglas
          específicas por servicio se aplican después respetando la prioridad
          barbero, puesto y servicio.
        </p>
      </section>

      <section className="barber-summary-grid">
        <article className="barber-summary-card">
          <FiUserCheck />
          <span>Barberos activos</span>
          <strong>{summary.barberosActivos}</strong>
        </article>

        <article className="barber-summary-card">
          <FiBriefcase />
          <span>Puestos activos</span>
          <strong>{summary.puestosActivos}</strong>
        </article>

        <article className="barber-summary-card">
          <FiUsers />
          <span>Propietarios activos</span>
          <strong>{summary.propietariosActivos}</strong>
        </article>

        <article className="barber-summary-card">
          <FiUser />
          <span>Comisión personalizada</span>
          <strong>{summary.personalizados}</strong>
        </article>
      </section>

      <div className="barber-tabs" role="tablist" aria-label="Gestión del equipo">
        <button
          type="button"
          className={activeTab === "barberos" ? "is-active" : ""}
          onClick={() => {
            setActiveTab("barberos");
            setFeedback(null);
          }}
        >
          <FiUsers />
          Barberos y equipo
        </button>

        <button
          type="button"
          className={activeTab === "puestos" ? "is-active" : ""}
          onClick={() => {
            setActiveTab("puestos");
            setFeedback(null);
          }}
        >
          <FiBriefcase />
          Puestos
        </button>

        <button
          type="button"
          className={activeTab === "reglas" ? "is-active" : ""}
          onClick={() => {
            setActiveTab("reglas");
            setFeedback(null);
          }}
        >
          <FiSliders />
          Reglas de comisión
        </button>

        <button
          type="button"
          className="barber-refresh-button"
          onClick={() => loadManagementData()}
          disabled={isLoading}
        >
          <FiRefreshCw />
          Actualizar
        </button>
      </div>

      {feedback && (
        <p
          className={`barber-feedback ${
            feedback.type === "success" ? "is-success" : "is-error"
          }`}
        >
          {feedback.message}
        </p>
      )}

      {activeTab === "barberos" ? (
        <>
          <form className="work-card barber-form-card" onSubmit={saveBarbero}>
            <div className="toolbar">
              <div>
                <strong>
                  {editingBarberoId
                    ? "Editar barbero o colaborador"
                    : "Agregar barbero o colaborador"}
                </strong>
                <small>
                  La comisión personalizada es opcional. Si queda vacía, se
                  hereda del puesto y luego del servicio.
                </small>
              </div>

              {editingBarberoId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetBarberoForm}
                >
                  <FiX />
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="barber-form-grid">
              <label className="form-field">
                <span>Nombre público</span>
                <input
                  type="text"
                  value={barberoForm.nombre_publico}
                  onChange={(event) =>
                    setBarberoForm((current) => ({
                      ...current,
                      nombre_publico: capitalizeWords(event.target.value),
                    }))
                  }
                  placeholder="Ej: Martín Gómez"
                  required
                />
              </label>

              <label className="form-field">
                <span>Puesto</span>
                <select
                  value={barberoForm.categoria_id}
                  onChange={(event) =>
                    setBarberoForm((current) => ({
                      ...current,
                      categoria_id: event.target.value,
                    }))
                  }
                >
                  <option value="">Sin puesto asignado</option>
                  {categorias.map((categoria) => (
                    <option key={categoria.id} value={categoria.id}>
                      {categoria.nombre}
                      {!categoria.activa ? " · Inactivo" : ""}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Comisión base</span>
                <select
                  value={barberoForm.commission_mode}
                  onChange={(event) =>
                    setBarberoForm((current) => ({
                      ...current,
                      commission_mode: event.target.value,
                      porcentaje_comision_default:
                        event.target.value === "personalizada"
                          ? current.porcentaje_comision_default
                          : "",
                    }))
                  }
                >
                  <option value="heredada">
                    Heredar del puesto o servicio
                  </option>
                  <option value="personalizada">
                    Comisión personalizada
                  </option>
                </select>
              </label>

              {barberoForm.commission_mode === "personalizada" && (
                <label className="form-field">
                  <span>Porcentaje personalizado</span>
                  <div className="percentage-input">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={barberoForm.porcentaje_comision_default}
                      onKeyDown={preventInvalidNumberKeys}
                      onChange={(event) =>
                        setBarberoForm((current) => ({
                          ...current,
                          porcentaje_comision_default: normalizeDecimalInput(
                            event.target.value
                          ),
                        }))
                      }
                      placeholder="Ej: 45"
                    />
                    <strong>%</strong>
                  </div>
                </label>
              )}

              <label className="form-field">
                <span>Frecuencia de pago</span>
                <select
                  value={barberoForm.frecuencia_pago_default}
                  onChange={(event) =>
                    setBarberoForm((current) => ({
                      ...current,
                      frecuencia_pago_default: event.target.value,
                    }))
                  }
                >
                  <option value="">Heredar del puesto</option>
                  {FRECUENCIAS.map((frecuencia) => (
                    <option key={frecuencia.value} value={frecuencia.value}>
                      {frecuencia.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="barber-switch-grid">
              <label className="barber-check-card">
                <input
                  type="checkbox"
                  checked={barberoForm.es_barbero}
                  onChange={(event) =>
                    setBarberoForm((current) => ({
                      ...current,
                      es_barbero: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Realiza servicios</strong>
                  <small>Puede figurar como barbero en atenciones.</small>
                </span>
              </label>

              <label className="barber-check-card">
                <input
                  type="checkbox"
                  checked={barberoForm.es_propietario}
                  onChange={(event) =>
                    setBarberoForm((current) => ({
                      ...current,
                      es_propietario: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Es propietario</strong>
                  <small>Identifica a dueños o administradores.</small>
                </span>
              </label>

              <label className="barber-check-card">
                <input
                  type="checkbox"
                  checked={barberoForm.activo}
                  onChange={(event) =>
                    setBarberoForm((current) => ({
                      ...current,
                      activo: event.target.checked,
                    }))
                  }
                />
                <span>
                  <strong>Activo</strong>
                  <small>Disponible para nuevas operaciones.</small>
                </span>
              </label>
            </div>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetBarberoForm}
              >
                <FiX />
                Limpiar
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingBarbero}
              >
                <FiSave />
                {isSavingBarbero
                  ? "Guardando..."
                  : editingBarberoId
                  ? "Guardar cambios"
                  : "Agregar al equipo"}
              </button>
            </div>
          </form>

          <section className="work-card barber-list-card">
            <div className="toolbar barber-list-toolbar">
              <div>
                <strong>Equipo registrado</strong>
                <small>
                  Los inactivos se conservan para no perder el historial.
                </small>
              </div>

              <div className="barber-list-filters">
                <label className="barber-search">
                  <FiSearch />
                  <input
                    type="search"
                    value={barberoSearch}
                    onChange={(event) => setBarberoSearch(event.target.value)}
                    placeholder="Buscar por nombre o puesto..."
                  />
                </label>

                <label className="barber-inline-check">
                  <input
                    type="checkbox"
                    checked={showInactiveBarberos}
                    onChange={(event) =>
                      setShowInactiveBarberos(event.target.checked)
                    }
                  />
                  Mostrar inactivos
                </label>
              </div>
            </div>

            {isLoading ? (
              <p className="empty-state">Cargando equipo...</p>
            ) : barberosFiltrados.length === 0 ? (
              <p className="empty-state">
                No hay colaboradores que coincidan con los filtros.
              </p>
            ) : (
              <div className="barber-card-list">
                {barberosFiltrados.map((barbero) => {
                  const categoria = categoriaById.get(barbero.categoria_id);
                  const commissionInfo = getBarberoCommissionInfo(barbero);
                  const frequencyInfo = getBarberoFrequencyInfo(barbero);
                  const personalRules = countRulesForBarbero(barbero.id);

                  return (
                    <article
                      key={barbero.id}
                      className={`barber-person-card ${
                        !barbero.activo ? "is-inactive" : ""
                      }`}
                    >
                      <div className="barber-person-main">
                        <span className="barber-avatar">
                          <FiUser />
                        </span>

                        <div>
                          <strong>{barbero.nombre_publico}</strong>
                          <small>
                            {categoria?.nombre || "Sin puesto asignado"}
                          </small>

                          <div className="barber-badges">
                            {barbero.es_barbero && <span>Barbero</span>}
                            {barbero.es_propietario && (
                              <span>Propietario</span>
                            )}
                            {!barbero.activo && (
                              <span className="is-muted">Inactivo</span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="barber-person-data">
                        <div>
                          <span>Comisión base</span>
                          <strong>{commissionInfo.label}</strong>
                          <small>{commissionInfo.source}</small>
                        </div>

                        <div>
                          <span>Frecuencia</span>
                          <strong>{frequencyInfo.label}</strong>
                          <small>{frequencyInfo.source}</small>
                        </div>

                        <div>
                          <span>Reglas específicas</span>
                          <strong>{personalRules}</strong>
                          <small>
                            {personalRules === 1
                              ? "Regla activa"
                              : "Reglas activas"}
                          </small>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost barber-edit-button"
                        onClick={() => startEditBarbero(barbero)}
                      >
                        <FiEdit2 />
                        Editar
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      ) : activeTab === "puestos" ? (
        <>
          <form className="work-card barber-form-card" onSubmit={saveCategoria}>
            <div className="toolbar">
              <div>
                <strong>
                  {editingCategoriaId ? "Editar puesto" : "Agregar puesto"}
                </strong>
                <small>
                  El puesto aporta la comisión y frecuencia predeterminadas a
                  quienes no tengan una configuración personal.
                </small>
              </div>

              {editingCategoriaId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetCategoriaForm}
                >
                  <FiX />
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="barber-form-grid">
              <label className="form-field">
                <span>Nombre del puesto</span>
                <input
                  type="text"
                  value={categoriaForm.nombre}
                  onChange={(event) =>
                    setCategoriaForm((current) => ({
                      ...current,
                      nombre: capitalizeWords(event.target.value),
                    }))
                  }
                  placeholder="Ej: Barbero senior"
                  required
                />
              </label>

              <label className="form-field barber-field-wide">
                <span>Descripción</span>
                <input
                  type="text"
                  value={categoriaForm.descripcion}
                  onChange={(event) =>
                    setCategoriaForm((current) => ({
                      ...current,
                      descripcion: capitalizeFirst(event.target.value),
                    }))
                  }
                  placeholder="Opcional"
                />
              </label>

              <label className="form-field">
                <span>Comisión predeterminada</span>
                <select
                  value={categoriaForm.commission_mode}
                  onChange={(event) =>
                    setCategoriaForm((current) => ({
                      ...current,
                      commission_mode: event.target.value,
                      porcentaje_comision_default:
                        event.target.value === "personalizada"
                          ? current.porcentaje_comision_default
                          : "",
                    }))
                  }
                >
                  <option value="sin_configurar">
                    Sin comisión base
                  </option>
                  <option value="personalizada">
                    Definir porcentaje
                  </option>
                </select>
              </label>

              {categoriaForm.commission_mode === "personalizada" && (
                <label className="form-field">
                  <span>Porcentaje del puesto</span>
                  <div className="percentage-input">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={categoriaForm.porcentaje_comision_default}
                      onKeyDown={preventInvalidNumberKeys}
                      onChange={(event) =>
                        setCategoriaForm((current) => ({
                          ...current,
                          porcentaje_comision_default: normalizeDecimalInput(
                            event.target.value
                          ),
                        }))
                      }
                      placeholder="Ej: 40"
                    />
                    <strong>%</strong>
                  </div>
                </label>
              )}

              <label className="form-field">
                <span>Frecuencia predeterminada</span>
                <select
                  value={categoriaForm.frecuencia_pago_default}
                  onChange={(event) =>
                    setCategoriaForm((current) => ({
                      ...current,
                      frecuencia_pago_default: event.target.value,
                    }))
                  }
                >
                  {FRECUENCIAS.map((frecuencia) => (
                    <option key={frecuencia.value} value={frecuencia.value}>
                      {frecuencia.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="barber-check-card barber-single-check">
              <input
                type="checkbox"
                checked={categoriaForm.activa}
                onChange={(event) =>
                  setCategoriaForm((current) => ({
                    ...current,
                    activa: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Puesto activo</strong>
                <small>Disponible para asignar a nuevos colaboradores.</small>
              </span>
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetCategoriaForm}
              >
                <FiX />
                Limpiar
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingCategoria}
              >
                <FiSave />
                {isSavingCategoria
                  ? "Guardando..."
                  : editingCategoriaId
                  ? "Guardar cambios"
                  : "Agregar puesto"}
              </button>
            </div>
          </form>

          <section className="work-card barber-list-card">
            <div className="toolbar barber-list-toolbar">
              <div>
                <strong>Puestos registrados</strong>
                <small>
                  Desactivar conserva las relaciones e historial existentes.
                </small>
              </div>

              <label className="barber-inline-check">
                <input
                  type="checkbox"
                  checked={showInactiveCategories}
                  onChange={(event) =>
                    setShowInactiveCategories(event.target.checked)
                  }
                />
                Mostrar inactivos
              </label>
            </div>

            {isLoading ? (
              <p className="empty-state">Cargando puestos...</p>
            ) : categoriasFiltradas.length === 0 ? (
              <p className="empty-state">Todavía no hay puestos registrados.</p>
            ) : (
              <div className="position-card-grid">
                {categoriasFiltradas.map((categoria) => {
                  const assignedMembers = countMembersForCategoria(categoria.id);
                  const categoryRules = countRulesForCategoria(categoria.id);

                  return (
                    <article
                      key={categoria.id}
                      className={`position-card ${
                        !categoria.activa ? "is-inactive" : ""
                      }`}
                    >
                      <div className="position-card__heading">
                        <span className="barber-avatar">
                          <FiBriefcase />
                        </span>

                        <div>
                          <strong>{categoria.nombre}</strong>
                          <small>
                            {categoria.descripcion || "Sin descripción"}
                          </small>
                        </div>
                      </div>

                      <div className="position-card__data">
                        <div>
                          <span>Comisión base</span>
                          <strong>
                            {formatPercent(
                              categoria.porcentaje_comision_default
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Frecuencia</span>
                          <strong>
                            {getFrequencyLabel(
                              categoria.frecuencia_pago_default
                            )}
                          </strong>
                        </div>

                        <div>
                          <span>Equipo asignado</span>
                          <strong>{assignedMembers}</strong>
                        </div>

                        <div>
                          <span>Reglas específicas</span>
                          <strong>{categoryRules}</strong>
                        </div>
                      </div>

                      <div className="position-card__footer">
                        <span
                          className={`status-pill ${
                            categoria.activa ? "is-active" : "is-inactive"
                          }`}
                        >
                          {categoria.activa ? "Activo" : "Inactivo"}
                        </span>

                        <button
                          type="button"
                          className="btn btn-ghost"
                          onClick={() => startEditCategoria(categoria)}
                        >
                          <FiEdit2 />
                          Editar
                        </button>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>

      ) : (
        <>
          <form className="work-card barber-form-card" onSubmit={saveRegla}>
            <div className="toolbar">
              <div>
                <strong>
                  {editingReglaId
                    ? "Editar regla de comisión"
                    : "Agregar regla de comisión"}
                </strong>
                <small>
                  Podés crear excepciones para un barbero, un puesto o un
                  servicio. No se permiten reglas activas superpuestas para el
                  mismo destino y período.
                </small>
              </div>

              {editingReglaId && (
                <button
                  type="button"
                  className="btn btn-ghost"
                  onClick={resetReglaForm}
                >
                  <FiX />
                  Cancelar edición
                </button>
              )}
            </div>

            <div className="commission-priority-box">
              <strong>Prioridad al calcular servicios</strong>
              <span>
                Barbero específico → puesto → servicio general → 0%
              </span>
            </div>

            <div className="barber-form-grid rule-form-grid">
              <label className="form-field">
                <span>Aplicar a</span>
                <select
                  value={reglaForm.alcance}
                  onChange={(event) =>
                    setReglaForm((current) => ({
                      ...current,
                      alcance: event.target.value,
                      objetivo_id: "",
                      servicio_id:
                        event.target.value === "servicio"
                          ? current.servicio_id
                          : current.servicio_id,
                    }))
                  }
                >
                  <option value="barbero">Barbero específico</option>
                  <option value="categoria">Puesto</option>
                  <option value="servicio">Servicio general</option>
                </select>
              </label>

              {reglaForm.alcance === "barbero" && (
                <label className="form-field">
                  <span>Barbero</span>
                  <select
                    value={reglaForm.objetivo_id}
                    onChange={(event) =>
                      setReglaForm((current) => ({
                        ...current,
                        objetivo_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Seleccionar barbero</option>
                    {barberos
                      .filter((barbero) => barbero.activo)
                      .map((barbero) => (
                        <option key={barbero.id} value={barbero.id}>
                          {barbero.nombre_publico}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              {reglaForm.alcance === "categoria" && (
                <label className="form-field">
                  <span>Puesto</span>
                  <select
                    value={reglaForm.objetivo_id}
                    onChange={(event) =>
                      setReglaForm((current) => ({
                        ...current,
                        objetivo_id: event.target.value,
                      }))
                    }
                    required
                  >
                    <option value="">Seleccionar puesto</option>
                    {categorias
                      .filter((categoria) => categoria.activa)
                      .map((categoria) => (
                        <option key={categoria.id} value={categoria.id}>
                          {categoria.nombre}
                        </option>
                      ))}
                  </select>
                </label>
              )}

              <label className="form-field">
                <span>
                  {reglaForm.alcance === "servicio"
                    ? "Servicio"
                    : "Servicio opcional"}
                </span>
                <select
                  value={reglaForm.servicio_id}
                  onChange={(event) =>
                    setReglaForm((current) => ({
                      ...current,
                      servicio_id: event.target.value,
                    }))
                  }
                  required={reglaForm.alcance === "servicio"}
                >
                  {reglaForm.alcance !== "servicio" && (
                    <option value="">Todos los servicios</option>
                  )}
                  {reglaForm.alcance === "servicio" && (
                    <option value="">Seleccionar servicio</option>
                  )}
                  {servicios.map((servicio) => (
                    <option key={servicio.id} value={servicio.id}>
                      {servicio.nombre}
                    </option>
                  ))}
                </select>
              </label>

              <label className="form-field">
                <span>Tipo de comisión</span>
                <select
                  value={reglaForm.valor_tipo}
                  onChange={(event) =>
                    setReglaForm((current) => ({
                      ...current,
                      valor_tipo: event.target.value,
                      valor: "",
                    }))
                  }
                >
                  <option value="porcentaje">Porcentaje</option>
                  <option value="monto_fijo">Monto fijo</option>
                </select>
              </label>

              <label className="form-field">
                <span>
                  {reglaForm.valor_tipo === "porcentaje"
                    ? "Porcentaje"
                    : "Monto fijo"}
                </span>
                <div className="percentage-input">
                  <input
                    type="text"
                    inputMode="decimal"
                    value={reglaForm.valor}
                    onKeyDown={preventInvalidNumberKeys}
                    onChange={(event) =>
                      setReglaForm((current) => ({
                        ...current,
                        valor: normalizeDecimalInput(event.target.value),
                      }))
                    }
                    placeholder={
                      reglaForm.valor_tipo === "porcentaje"
                        ? "Ej: 45"
                        : "Ej: 5000"
                    }
                    required
                  />
                  <strong>
                    {reglaForm.valor_tipo === "porcentaje" ? "%" : "$"}
                  </strong>
                </div>
              </label>

              <label className="form-field">
                <span>Vigencia desde</span>
                <input
                  type="date"
                  value={reglaForm.vigencia_desde}
                  onChange={(event) =>
                    setReglaForm((current) => ({
                      ...current,
                      vigencia_desde: event.target.value,
                    }))
                  }
                  required
                />
              </label>

              <label className="form-field">
                <span>Vigencia hasta</span>
                <input
                  type="date"
                  value={reglaForm.vigencia_hasta}
                  min={reglaForm.vigencia_desde || undefined}
                  onChange={(event) =>
                    setReglaForm((current) => ({
                      ...current,
                      vigencia_hasta: event.target.value,
                    }))
                  }
                />
                <small>Vacío significa sin fecha de finalización.</small>
              </label>

              <label className="form-field">
                <span>Frecuencia de pago</span>
                <select
                  value={reglaForm.frecuencia_pago}
                  onChange={(event) =>
                    setReglaForm((current) => ({
                      ...current,
                      frecuencia_pago: event.target.value,
                    }))
                  }
                >
                  {FRECUENCIAS.map((frecuencia) => (
                    <option key={frecuencia.value} value={frecuencia.value}>
                      {frecuencia.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="barber-check-card barber-single-check">
              <input
                type="checkbox"
                checked={reglaForm.activa}
                onChange={(event) =>
                  setReglaForm((current) => ({
                    ...current,
                    activa: event.target.checked,
                  }))
                }
              />
              <span>
                <strong>Regla activa</strong>
                <small>
                  Las reglas inactivas se conservan pero no se aplican.
                </small>
              </span>
            </label>

            <div className="form-actions">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetReglaForm}
              >
                <FiX />
                Limpiar
              </button>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={isSavingRegla}
              >
                <FiSave />
                {isSavingRegla
                  ? "Guardando..."
                  : editingReglaId
                  ? "Guardar cambios"
                  : "Crear regla"}
              </button>
            </div>
          </form>

          <section className="work-card barber-list-card">
            <div className="toolbar barber-list-toolbar">
              <div>
                <strong>Reglas registradas</strong>
                <small>
                  Las reglas vigentes se aplicarán a las próximas atenciones.
                </small>
              </div>

              <div className="barber-list-filters">
                <label className="barber-search">
                  <FiSearch />
                  <input
                    type="search"
                    value={reglaSearch}
                    onChange={(event) => setReglaSearch(event.target.value)}
                    placeholder="Buscar barbero, puesto o servicio..."
                  />
                </label>

                <label className="barber-inline-check">
                  <input
                    type="checkbox"
                    checked={showInactiveRules}
                    onChange={(event) =>
                      setShowInactiveRules(event.target.checked)
                    }
                  />
                  Mostrar inactivas
                </label>
              </div>
            </div>

            {isLoading ? (
              <p className="empty-state">Cargando reglas...</p>
            ) : reglasFiltradas.length === 0 ? (
              <p className="empty-state">
                Todavía no hay reglas de comisión con esos filtros.
              </p>
            ) : (
              <div className="commission-rule-list">
                {reglasFiltradas.map((regla) => {
                  const destination = getRuleDestination(regla);
                  const status = getRuleStatus(regla);

                  return (
                    <article
                      key={regla.id}
                      className={`commission-rule-card ${status.className}`}
                    >
                      <div className="commission-rule-heading">
                        <span className="barber-avatar">
                          {regla.porcentaje !== null &&
                          regla.porcentaje !== undefined ? (
                            <FiPercent />
                          ) : (
                            <FiDollarSign />
                          )}
                        </span>

                        <div>
                          <span>{destination.type}</span>
                          <strong>{destination.name}</strong>
                          <small>{getRuleServiceLabel(regla)}</small>
                        </div>
                      </div>

                      <div className="commission-rule-data">
                        <div>
                          <span>Comisión</span>
                          <strong>{getRuleValueLabel(regla)}</strong>
                        </div>

                        <div>
                          <span>Frecuencia</span>
                          <strong>
                            {getFrequencyLabel(regla.frecuencia_pago)}
                          </strong>
                        </div>

                        <div>
                          <span>Vigencia</span>
                          <strong>
                            {regla.vigencia_desde}
                            {regla.vigencia_hasta
                              ? ` al ${regla.vigencia_hasta}`
                              : " en adelante"}
                          </strong>
                        </div>

                        <div>
                          <span>Estado</span>
                          <strong>{status.label}</strong>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="btn btn-ghost barber-edit-button"
                        onClick={() => startEditRegla(regla)}
                      >
                        <FiEdit2 />
                        Editar
                      </button>
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </>
      )}
    </PageShell>
  );
}