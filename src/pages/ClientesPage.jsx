import { useState } from "react";
import { FiPlus, FiSearch } from "react-icons/fi";
import PageShell from "../components/layout/PageShell";
import { useAppData } from "../context/AppDataContext";

export default function ClientesPage() {
  const { clientes } = useAppData();
  const [search, setSearch] = useState("");

  const filteredClientes = clientes.filter((cliente) => {
    const text = `${cliente.nombre || ""} ${cliente.apellido || ""} ${
      cliente.telefono || ""
    } ${cliente.whatsapp || ""}`.toLowerCase();

    return text.includes(search.toLowerCase());
  });

  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Clientes</span>
        <h2>Clientes</h2>
        <p>
          Primera vista de búsqueda. Después agregamos alta rápida e importación
          CSV/Excel.
        </p>
      </section>

      <section className="work-card">
        <div className="toolbar">
          <label className="search-box">
            <FiSearch />
            <input
              type="search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar cliente..."
            />
          </label>

          <button type="button" className="btn btn-primary">
            <FiPlus />
            Nuevo cliente
          </button>
        </div>

        <div className="simple-list">
          {filteredClientes.length === 0 ? (
            <p className="empty-state">No hay clientes para mostrar.</p>
          ) : (
            filteredClientes.map((cliente) => (
              <article key={cliente.id} className="list-row">
                <div>
                  <strong>
                    {cliente.nombre} {cliente.apellido}
                  </strong>
                  <small>
                    {cliente.whatsapp ||
                      cliente.telefono ||
                      "Sin teléfono cargado"}
                  </small>
                </div>

                <span>{cliente.origen || "manual"}</span>
              </article>
            ))
          )}
        </div>
      </section>
    </PageShell>
  );
}