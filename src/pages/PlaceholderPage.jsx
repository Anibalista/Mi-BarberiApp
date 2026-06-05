import PageShell from "../components/layout/PageShell";

export default function PlaceholderPage({ title, description }) {
  return (
    <PageShell>
      <section className="page-heading">
        <span className="badge">Próxima etapa</span>
        <h2>{title}</h2>
        <p>{description}</p>
      </section>

      <section className="work-card">
        <p className="empty-state">
          Esta pantalla ya tiene ruta creada. La vamos a implementar cuando
          terminemos los flujos principales de venta, turno y atención rápida.
        </p>
      </section>
    </PageShell>
  );
}