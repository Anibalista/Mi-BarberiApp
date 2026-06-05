import AppHeader from "./AppHeader";

export default function PageShell({ children }) {
  return (
    <main className="app-shell">
      <AppHeader />
      {children}
    </main>
  );
}