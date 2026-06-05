import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { useAuth } from "./AuthContext";

const AppDataContext = createContext(null);

export function AppDataProvider({ children }) {
  const { user, isAuthenticated } = useAuth();

  const [perfil, setPerfil] = useState(null);
  const [negocio, setNegocio] = useState(null);
  const [sucursal, setSucursal] = useState(null);
  const [colaborador, setColaborador] = useState(null);

  const [clientes, setClientes] = useState([]);
  const [servicios, setServicios] = useState([]);
  const [productos, setProductos] = useState([]);
  const [mediosPago, setMediosPago] = useState([]);

  const [isAppDataLoading, setIsAppDataLoading] = useState(true);
  const [appDataError, setAppDataError] = useState("");

  async function loadAppData() {
    if (!isAuthenticated || !user?.id) {
      setPerfil(null);
      setNegocio(null);
      setSucursal(null);
      setColaborador(null);
      setClientes([]);
      setServicios([]);
      setProductos([]);
      setMediosPago([]);
      setIsAppDataLoading(false);
      return;
    }

    try {
      setIsAppDataLoading(true);
      setAppDataError("");

      const { data: perfilData, error: perfilError } = await supabase
        .from("perfiles")
        .select("*")
        .eq("auth_user_id", user.id)
        .maybeSingle();

      if (perfilError) {
        throw perfilError;
      }

      if (!perfilData) {
        setAppDataError(
          "Tu usuario inició sesión, pero todavía no tiene un perfil vinculado al negocio."
        );
        return;
      }

      setPerfil(perfilData);

      const negocioId = perfilData.negocio_id;
      const sucursalId = perfilData.sucursal_id_actual;

      if (!negocioId) {
        setAppDataError(
          "Tu perfil existe, pero todavía no está vinculado a un negocio."
        );
        return;
      }

      const [
        negocioResult,
        sucursalResult,
        colaboradorResult,
        clientesResult,
        serviciosResult,
        productosResult,
        mediosPagoResult,
      ] = await Promise.all([
        supabase.from("negocios").select("*").eq("id", negocioId).maybeSingle(),

        sucursalId
          ? supabase
              .from("sucursales")
              .select("*")
              .eq("id", sucursalId)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),

        supabase
          .from("colaboradores")
          .select("*")
          .eq("negocio_id", negocioId)
          .eq("perfil_id", perfilData.id)
          .maybeSingle(),

        supabase
          .from("clientes")
          .select("*")
          .eq("negocio_id", negocioId)
          .order("creado_en", { ascending: false })
          .limit(20),

        supabase
          .from("servicios")
          .select("*")
          .eq("negocio_id", negocioId)
          .eq("activo", true)
          .order("nombre", { ascending: true }),

        supabase
          .from("productos")
          .select("*")
          .eq("negocio_id", negocioId)
          .eq("activo", true)
          .order("nombre", { ascending: true }),

        supabase
          .from("medios_pago")
          .select("*")
          .eq("negocio_id", negocioId)
          .eq("activo", true)
          .order("nombre", { ascending: true }),
      ]);

      if (negocioResult.error) throw negocioResult.error;
      if (sucursalResult.error) throw sucursalResult.error;
      if (colaboradorResult.error) throw colaboradorResult.error;
      if (clientesResult.error) throw clientesResult.error;
      if (serviciosResult.error) throw serviciosResult.error;
      if (productosResult.error) throw productosResult.error;
      if (mediosPagoResult.error) throw mediosPagoResult.error;

      setNegocio(negocioResult.data ?? null);
      setSucursal(sucursalResult.data ?? null);
      setColaborador(colaboradorResult.data ?? null);
      setClientes(clientesResult.data ?? []);
      setServicios(serviciosResult.data ?? []);
      setProductos(productosResult.data ?? []);
      setMediosPago(mediosPagoResult.data ?? []);
    } catch (error) {
      console.error("Error cargando datos iniciales:", {
        message: error?.message,
        details: error?.details,
        hint: error?.hint,
        code: error?.code,
        fullError: error,
      });

      setAppDataError(
        "No se pudieron cargar los datos iniciales del negocio."
      );
    } finally {
      setIsAppDataLoading(false);
    }
  }

  useEffect(() => {
    loadAppData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.id]);

  const value = useMemo(
    () => ({
      perfil,
      negocio,
      sucursal,
      colaborador,
      clientes,
      servicios,
      productos,
      mediosPago,
      isAppDataLoading,
      appDataError,
      refreshAppData: loadAppData,
    }),
    [
      perfil,
      negocio,
      sucursal,
      colaborador,
      clientes,
      servicios,
      productos,
      mediosPago,
      isAppDataLoading,
      appDataError,
    ]
  );

  return (
    <AppDataContext.Provider value={value}>
      {children}
    </AppDataContext.Provider>
  );
}

export function useAppData() {
  const context = useContext(AppDataContext);

  if (!context) {
    throw new Error("useAppData debe usarse dentro de AppDataProvider");
  }

  return context;
}