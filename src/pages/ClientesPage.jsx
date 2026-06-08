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
import { normalizeText, preventInvalidNumberKeys } from "../utils/formGuards";

const emptyClientForm = {
  id: null,
  nombre: "",
  apellido: "",
  documento: "",
  email: "",
  paisTelefono: "+54",
  areaTelefono: "",
  numeroTelefono: "",
  diaNacimiento: "",
  mesNacimiento: "",
  anioNacimiento: "",
  domicilio: "",
  observaciones: "",
  origen: "manual",
};

const countryCodes = [
  { codigo: "+54", nombre: "Argentina" },
  { codigo: "+598", nombre: "Uruguay" },
];

const knownArgentinaAreaCodes = [
  // Entre Ríos
  "3446",
  "3442",
  "3444",
  "3445",
  "3447",
  "3454",
  "3456",
  "3458",
  "343",
  "345",

  // Buenos Aires
  "2202",
  "11",
  "221",
  "223",
  "236",
  "237",
  "249",
  "291",
  "348",
].sort((a, b) => b.length - a.length);

function capitalizeWords(value) {
  return String(value || "")
    .trimStart()
    .toLowerCase()
    .replace(/\s+/g, " ")
    .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase());
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "");
}

function normalizeNullableText(value) {
  const cleanValue = String(value || "").trim();

  return cleanValue || null;
}

function normalizePhoneForCompare(value) {
  return String(value || "").replace(/\D/g, "");
}

function buildPhone({ paisTelefono, areaTelefono, numeroTelefono }) {
  const countryCode = String(paisTelefono || "+54").replace(/\D/g, "");
  let area = onlyDigits(areaTelefono);
  const number = onlyDigits(numeroTelefono);

  if (!number) {
    return {
      value: null,
      label: "Sin teléfono",
      error: "",
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

function parsePhoneWithHyphen(phone) {
  const cleanPhone = String(phone || "").trim();

  if (!cleanPhone.includes("-")) return null;

  const parts = cleanPhone.split("-").map((part) => part.trim());

  if (parts.length === 3) {
    const [country, area, number] = parts;

    return {
      paisTelefono: country.startsWith("+") ? country : `+${country}`,
      areaTelefono: onlyDigits(area),
      numeroTelefono: onlyDigits(number),
    };
  }

  if (parts.length === 2) {
    const [country, number] = parts;

    return {
      paisTelefono: country.startsWith("+") ? country : `+${country}`,
      areaTelefono: "",
      numeroTelefono: onlyDigits(number),
    };
  }

  return null;
}

function parseArgentinaPhone(rest) {
  const cleanRest = onlyDigits(rest);

  if (!cleanRest) {
    return {
      paisTelefono: "+54",
      areaTelefono: "",
      numeroTelefono: "",
    };
  }

  if (cleanRest.length === 11 && cleanRest.startsWith("9")) {
    return parseArgentinaPhone(cleanRest.slice(1));
  }

  const matchedAreaCode = knownArgentinaAreaCodes.find((areaCode) =>
    cleanRest.startsWith(areaCode)
  );

  if (matchedAreaCode) {
    return {
      paisTelefono: "+54",
      areaTelefono: matchedAreaCode,
      numeroTelefono: cleanRest.slice(matchedAreaCode.length),
    };
  }

  if (cleanRest.length === 8) {
    return {
      paisTelefono: "+54",
      areaTelefono: "11",
      numeroTelefono: cleanRest,
    };
  }

  if (cleanRest.length === 6) {
    return {
      paisTelefono: "+54",
      areaTelefono: "3446",
      numeroTelefono: cleanRest,
    };
  }

  if (cleanRest.length > 8) {
    return {
      paisTelefono: "+54",
      areaTelefono: cleanRest.slice(0, cleanRest.length - 8),
      numeroTelefono: cleanRest.slice(-8),
    };
  }

  return {
    paisTelefono: "+54",
    areaTelefono: "",
    numeroTelefono: cleanRest,
  };
}

function parsePhone(phone) {
  const cleanPhone = String(phone || "").trim();

  if (!cleanPhone) {
    return {
      paisTelefono: "+54",
      areaTelefono: "",
      numeroTelefono: "",
    };
  }

  const parsedByHyphen = parsePhoneWithHyphen(cleanPhone);

  if (parsedByHyphen) {
    return parsedByHyphen;
  }

  const digits = cleanPhone.replace(/\D/g, "");

  if (digits.startsWith("54")) {
    return parseArgentinaPhone(digits.slice(2));
  }

  if (digits.startsWith("598")) {
    const rest = digits.slice(3);

    return {
      paisTelefono: "+598",
      areaTelefono: "",
      numeroTelefono: rest,
    };
  }

  return parseArgentinaPhone(digits);
}

function buildBirthDate({ diaNacimiento, mesNacimiento, anioNacimiento }) {
  const day = onlyDigits(diaNacimiento);
  const month = onlyDigits(mesNacimiento);
  const year = onlyDigits(anioNacimiento);

  if (!day && !month && !year) {
    return {
      value: null,
      warning: "",
      needsConfirmation: false,
      error: "",
    };
  }

  if (!day || !month) {
    return {
      value: null,
      warning: "",
      needsConfirmation: false,
      error: "Para cargar cumpleaños necesitás al menos día y mes.",
    };
  }

  const currentYear = new Date().getFullYear();
  const finalYear = year || String(currentYear);

  const dayNumber = Number(day);
  const monthNumber = Number(month);
  const yearNumber = Number(finalYear);

  if (dayNumber < 1 || dayNumber > 31) {
    return {
      value: null,
      warning: "",
      needsConfirmation: false,
      error: "El día de nacimiento debe estar entre 1 y 31.",
    };
  }

  if (monthNumber < 1 || monthNumber > 12) {
    return {
      value: null,
      warning: "",
      needsConfirmation: false,
      error: "El mes de nacimiento debe estar entre 1 y 12.",
    };
  }

  if (yearNumber < 1900 || yearNumber > currentYear) {
    return {
      value: null,
      warning: "",
      needsConfirmation: false,
      error: `El año de nacimiento debe estar entre 1900 y ${currentYear}.`,
    };
  }

  const normalizedDate = `${String(yearNumber).padStart(4, "0")}-${String(
    monthNumber
  ).padStart(2, "0")}-${String(dayNumber).padStart(2, "0")}`;

  const testDate = new Date(`${normalizedDate}T00:00:00`);

  const isInvalidDate =
    Number.isNaN(testDate.getTime()) ||
    testDate.getUTCFullYear() !== yearNumber ||
    testDate.getUTCMonth() + 1 !== monthNumber ||
    testDate.getUTCDate() !== dayNumber;

  if (isInvalidDate) {
    return {
      value: null,
      warning: "",
      needsConfirmation: false,
      error: "La fecha de nacimiento no es válida.",
    };
  }

  return {
    value: normalizedDate,
    warning: year
      ? ""
      : `No ingresaste año. Se guardará la fecha como ${String(
          dayNumber
        ).padStart(2, "0")}/${String(monthNumber).padStart(
          2,
          "0"
        )}/${currentYear}.`,
    needsConfirmation: !year,
    error: "",
  };
}

function parseBirthDate(dateValue) {
  if (!dateValue) {
    return {
      diaNacimiento: "",
      mesNacimiento: "",
      anioNacimiento: "",
    };
  }

  const [year, month, day] = String(dateValue).split("-");

  return {
    diaNacimiento: String(Number(day || "")) || "",
    mesNacimiento: String(Number(month || "")) || "",
    anioNacimiento: year || "",
  };
}

function formatBirthDate(dateValue) {
  if (!dateValue) return "Sin fecha";

  const [year, month, day] = String(dateValue).split("-");

  if (!year || !month || !day) return "Sin fecha";

  return `${day}/${month}/${year}`;
}

export default function ClientesPage() {
  const { negocio, refreshAppData } = useAppData();

  const [clientes, setClientes] = useState([]);
  const [form, setForm] = useState(emptyClientForm);

  const [search, setSearch] = useState("");
  const [showAddress, setShowAddress] = useState(false);

  const [sortConfig, setSortConfig] = useState({
    key: "nombre",
    direction: "asc",
  });

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState("");

  const isEditing = Boolean(form.id);

  const phonePreview = useMemo(() => buildPhone(form), [form]);
  const birthDatePreview = useMemo(() => buildBirthDate(form), [form]);

  async function loadClientesData() {
    if (!negocio?.id) return;

    try {
      setIsLoading(true);
      setFeedback("");

      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .eq("negocio_id", negocio.id)
        .order("nombre", { ascending: true });

      if (error) throw error;

      setClientes(data ?? []);
    } catch (error) {
      console.error("Error cargando clientes:", error);
      setFeedback("No se pudieron cargar los clientes.");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    loadClientesData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [negocio?.id]);

  const filteredClientes = useMemo(() => {
    const normalizedSearch = normalizeText(search);

    const result = clientes.filter((cliente) => {
      const text = normalizeText(
        `${cliente.nombre || ""} ${cliente.apellido || ""} ${
          cliente.telefono || ""
        } ${cliente.whatsapp || ""} ${cliente.email || ""} ${
          cliente.documento || ""
        }`
      );

      return text.includes(normalizedSearch);
    });

    return [...result].sort((a, b) => {
      const direction = sortConfig.direction === "asc" ? 1 : -1;

      if (sortConfig.key === "nombre") {
        const nameA = `${a.nombre || ""} ${a.apellido || ""}`;
        const nameB = `${b.nombre || ""} ${b.apellido || ""}`;

        return nameA.localeCompare(nameB, "es") * direction;
      }

      if (sortConfig.key === "telefono") {
        return (
          String(a.telefono || "").localeCompare(String(b.telefono || ""), "es") *
          direction
        );
      }

      if (sortConfig.key === "fecha_nacimiento") {
        return (
          String(a.fecha_nacimiento || "").localeCompare(
            String(b.fecha_nacimiento || ""),
            "es"
          ) * direction
        );
      }

      if (sortConfig.key === "origen") {
        return (
          String(a.origen || "").localeCompare(String(b.origen || ""), "es") *
          direction
        );
      }

      return 0;
    });
  }, [clientes, search, sortConfig]);

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
    const capitalizedFields = ["nombre", "apellido", "domicilio"];

    setForm((current) => ({
      ...current,
      [field]: capitalizedFields.includes(field)
        ? capitalizeWords(value)
        : value,
    }));
  }

  function updateDigitField(field, value, maxLength) {
    const cleanValue = onlyDigits(value).slice(0, maxLength);

    setForm((current) => ({
      ...current,
      [field]: cleanValue,
    }));
  }

  function resetForm() {
    setForm(emptyClientForm);
    setShowAddress(false);
    setFeedback("");
  }

  function loadClientForEdit(cliente) {
    const parsedPhone = parsePhone(cliente.telefono || cliente.whatsapp);
    const parsedBirthDate = parseBirthDate(cliente.fecha_nacimiento);

    setForm({
      id: cliente.id,
      nombre: cliente.nombre || "",
      apellido: cliente.apellido || "",
      documento: cliente.documento || "",
      email: cliente.email || "",
      paisTelefono: parsedPhone.paisTelefono,
      areaTelefono: parsedPhone.areaTelefono,
      numeroTelefono: parsedPhone.numeroTelefono,
      diaNacimiento: parsedBirthDate.diaNacimiento,
      mesNacimiento: parsedBirthDate.mesNacimiento,
      anioNacimiento: parsedBirthDate.anioNacimiento,
      domicilio: cliente.domicilio || "",
      observaciones: cliente.observaciones || "",
      origen: cliente.origen || "manual",
    });

    setShowAddress(Boolean(cliente.domicilio));
    setFeedback(`Editando cliente: ${cliente.nombre}`);
  }

  function findDuplicateByPhone(phoneValue) {
    if (!phoneValue) return null;

    const normalizedNewPhone = normalizePhoneForCompare(phoneValue);

    return clientes.find((cliente) => {
      const normalizedStoredPhone = normalizePhoneForCompare(
        cliente.telefono || cliente.whatsapp
      );

      const samePhone =
        normalizedStoredPhone && normalizedStoredPhone === normalizedNewPhone;

      const differentClient = cliente.id !== form.id;

      return samePhone && differentClient;
    });
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!negocio?.id) {
      setFeedback("No se encontró el negocio actual.");
      return;
    }

    if (!form.nombre.trim()) {
      setFeedback("El nombre del cliente es obligatorio.");
      return;
    }

    const phoneResult = buildPhone(form);

    if (phoneResult.error) {
      setFeedback(phoneResult.error);
      return;
    }

    const birthDateResult = buildBirthDate(form);

    if (birthDateResult.error) {
      setFeedback(birthDateResult.error);
      return;
    }

    if (birthDateResult.needsConfirmation) {
      const shouldContinue = window.confirm(
        `${birthDateResult.warning}\n\n¿Querés guardar la fecha de nacimiento con ese año?`
      );

      if (!shouldContinue) {
        setFeedback("Guardado cancelado. Podés completar el año antes de guardar.");
        return;
      }
    }

    const duplicateClient = findDuplicateByPhone(phoneResult.value);

    if (duplicateClient) {
      const shouldEditExisting = window.confirm(
        `Ya existe un cliente con ese teléfono: ${duplicateClient.nombre}. ¿Querés cargarlo para modificarlo?`
      );

      if (shouldEditExisting) {
        loadClientForEdit(duplicateClient);
      }

      return;
    }

    try {
      setIsSaving(true);
      setFeedback("");

      const payload = {
        negocio_id: negocio.id,
        nombre: capitalizeWords(form.nombre).trim(),
        apellido: normalizeNullableText(capitalizeWords(form.apellido)),
        documento: normalizeNullableText(form.documento),
        email: normalizeNullableText(form.email),
        telefono: phoneResult.value,
        whatsapp: phoneResult.value,
        fecha_nacimiento: birthDateResult.value,
        domicilio: showAddress ? normalizeNullableText(form.domicilio) : null,
        observaciones: normalizeNullableText(form.observaciones),
        origen: form.origen || "manual",
      };

      if (isEditing) {
        const { error } = await supabase
          .from("clientes")
          .update(payload)
          .eq("id", form.id)
          .eq("negocio_id", negocio.id);

        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert(payload);

        if (error) throw error;
      }

      setFeedback(
        isEditing
          ? "Cliente actualizado correctamente."
          : "Cliente creado correctamente."
      );

      resetForm();
      await loadClientesData();
      await refreshAppData();
    } catch (error) {
      console.error("Error guardando cliente:", error);
      setFeedback("No se pudo guardar el cliente.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Clientes</span>
        <h2>ABM de clientes</h2>
        <p>
          Registrá clientes rápido con nombre obligatorio, teléfono recomendado y
          cumpleaños separado por día, mes y año.
        </p>
      </section>

      <section className="work-card client-form-card">
        <div className="toolbar">
          <div>
            <strong>{isEditing ? "Modificar cliente" : "Nuevo cliente"}</strong>
            <small>
              El cliente puede registrarse solo con nombre, pero teléfono y
              cumpleaños ayudan a fidelizar.
            </small>
          </div>

          <button type="button" className="btn btn-ghost" onClick={resetForm}>
            <FiX />
            Limpiar
          </button>
        </div>

        <form className="client-form" onSubmit={handleSubmit}>
          <div className="form-grid">
            <label className="form-field">
              <span>Nombre</span>
              <input
                list="clientes-existentes"
                type="text"
                value={form.nombre}
                onChange={(event) =>
                  updateFormField("nombre", event.target.value)
                }
                placeholder="Ej: Juan"
                required
              />

              <datalist id="clientes-existentes">
                {clientes.map((cliente) => (
                  <option
                    key={cliente.id}
                    value={`${cliente.nombre || ""} ${
                      cliente.apellido || ""
                    }`.trim()}
                  />
                ))}
              </datalist>
            </label>

            <label className="form-field">
              <span>Apellido</span>
              <input
                type="text"
                value={form.apellido}
                onChange={(event) =>
                  updateFormField("apellido", event.target.value)
                }
                placeholder="Opcional"
              />
            </label>

            <label className="form-field">
              <span>Documento</span>
              <input
                type="text"
                inputMode="numeric"
                value={form.documento}
                onKeyDown={preventInvalidNumberKeys}
                onChange={(event) =>
                  updateDigitField("documento", event.target.value, 12)
                }
                placeholder="Opcional"
              />
            </label>

            <label className="form-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) =>
                  updateFormField("email", event.target.value)
                }
                placeholder="Opcional"
              />
            </label>
          </div>

          <div className="phone-box">
            <div>
              <strong>Teléfono / WhatsApp</strong>
              <small>
                Si no cargás área, se asume 3446 para 6 dígitos o 11 para 8
                dígitos. No puede iniciar con 15. Se guarda con guiones para
                poder editarlo correctamente.
              </small>
            </div>

            <div className="phone-grid">
              <label className="form-field">
                <span>País</span>
                <select
                  value={form.paisTelefono}
                  onChange={(event) =>
                    updateFormField("paisTelefono", event.target.value)
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
                  value={form.areaTelefono}
                  onKeyDown={preventInvalidNumberKeys}
                  onChange={(event) =>
                    updateDigitField("areaTelefono", event.target.value, 6)
                  }
                  placeholder="Ej: 3446"
                />
              </label>

              <label className="form-field">
                <span>Número</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.numeroTelefono}
                  onKeyDown={preventInvalidNumberKeys}
                  onChange={(event) =>
                    updateDigitField("numeroTelefono", event.target.value, 10)
                  }
                  placeholder="Ej: 646464"
                />
              </label>
            </div>

            <p className="phone-preview">
              Teléfono completo: <strong>{phonePreview.label}</strong>
            </p>
          </div>

          <div className="birth-box">
            <div>
              <strong>Fecha de nacimiento</strong>
              <small>
                Si cargás día y mes sin año, se pedirá confirmación antes de
                guardar usando el año actual. Si queda vacío al modificar, se
                guarda sin fecha.
              </small>
            </div>

            <div className="birth-grid">
              <label className="form-field">
                <span>Día</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.diaNacimiento}
                  onKeyDown={preventInvalidNumberKeys}
                  onChange={(event) =>
                    updateDigitField("diaNacimiento", event.target.value, 2)
                  }
                  placeholder="DD"
                />
              </label>

              <label className="form-field">
                <span>Mes</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.mesNacimiento}
                  onKeyDown={preventInvalidNumberKeys}
                  onChange={(event) =>
                    updateDigitField("mesNacimiento", event.target.value, 2)
                  }
                  placeholder="MM"
                />
              </label>

              <label className="form-field">
                <span>Año</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={form.anioNacimiento}
                  onKeyDown={preventInvalidNumberKeys}
                  onChange={(event) =>
                    updateDigitField("anioNacimiento", event.target.value, 4)
                  }
                  placeholder="AAAA"
                />
              </label>
            </div>

            {birthDatePreview.warning && (
              <p className="phone-preview">
                Aviso: <strong>{birthDatePreview.warning}</strong>
              </p>
            )}
          </div>

          <div className="product-options-grid">
            <button
              type="button"
              className={`status-switch ${showAddress ? "is-active" : ""}`}
              onClick={() => setShowAddress((current) => !current)}
            >
              {showAddress ? "Ocultar domicilio" : "Mostrar domicilio"}
            </button>
          </div>

          {showAddress && (
            <label className="form-field">
              <span>Domicilio</span>
              <input
                type="text"
                value={form.domicilio}
                onChange={(event) =>
                  updateFormField("domicilio", event.target.value)
                }
                placeholder="Opcional"
              />
            </label>
          )}

          <label className="form-field">
            <span>Observaciones</span>
            <textarea
              rows="3"
              value={form.observaciones}
              onChange={(event) =>
                updateFormField("observaciones", event.target.value)
              }
              placeholder="Ej: Prefiere turno por la tarde."
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
              {isSaving
                ? "Guardando..."
                : isEditing
                  ? "Actualizar cliente"
                  : "Crear cliente"}
            </button>
          </div>
        </form>
      </section>

      <section className="work-card">
        <div className="toolbar">
          <div>
            <strong>Clientes cargados</strong>
            <small>
              Lista ordenada alfabéticamente por defecto. Podés buscar por
              nombre, teléfono, documento o email.
            </small>
          </div>

          <div className="toolbar-actions">
            <label className="search-box">
              <input
                type="search"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar cliente..."
              />
            </label>

            <button
              type="button"
              className="btn btn-ghost"
              onClick={loadClientesData}
            >
              <FiRefreshCw />
              Actualizar
            </button>
          </div>
        </div>

        {isLoading ? (
          <p className="empty-state">Cargando clientes...</p>
        ) : filteredClientes.length === 0 ? (
          <p className="empty-state">No hay clientes para mostrar.</p>
        ) : (
          <div className="table-wrapper">
            <table className="data-table">
              <thead>
                <tr>
                  <th>
                    <button type="button" onClick={() => updateSort("nombre")}>
                      Cliente <SortIcon columnKey="nombre" />
                    </button>
                  </th>

                  <th>
                    <button type="button" onClick={() => updateSort("telefono")}>
                      Teléfono <SortIcon columnKey="telefono" />
                    </button>
                  </th>

                  <th>Email</th>

                  <th>
                    <button
                      type="button"
                      onClick={() => updateSort("fecha_nacimiento")}
                    >
                      Cumpleaños <SortIcon columnKey="fecha_nacimiento" />
                    </button>
                  </th>

                  <th>
                    <button type="button" onClick={() => updateSort("origen")}>
                      Origen <SortIcon columnKey="origen" />
                    </button>
                  </th>

                  <th>Acciones</th>
                </tr>
              </thead>

              <tbody>
                {filteredClientes.map((cliente) => (
                  <tr key={cliente.id}>
                    <td>
                      <strong>
                        {cliente.nombre} {cliente.apellido}
                      </strong>
                      <small>{cliente.documento || "Sin documento"}</small>
                    </td>

                    <td>{cliente.telefono || cliente.whatsapp || "Sin teléfono"}</td>

                    <td>{cliente.email || "Sin email"}</td>

                    <td>{formatBirthDate(cliente.fecha_nacimiento)}</td>

                    <td>
                      <span className="status-pill is-warning">
                        {cliente.origen || "manual"}
                      </span>
                    </td>

                    <td>
                      <div className="table-actions">
                        <button
                          type="button"
                          className="icon-button"
                          onClick={() => loadClientForEdit(cliente)}
                          aria-label="Editar cliente"
                        >
                          <FiEdit2 />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </PageShell>
  );
}