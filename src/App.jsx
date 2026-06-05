import { useEffect, useState } from "react";
import { supabase } from "./lib/supabaseClient";

function App() {
  const [session, setSession] = useState(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, currentSession) => {
      setSession(currentSession);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const handleLoginWithGoogle = async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: "http://localhost:5173/auth/callback",
      },
    });

    if (error) {
      console.error("Error iniciando sesión con Google:", error.message);
    }
  };

  const handleLogout = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      console.error("Error cerrando sesión:", error.message);
    }
  };

  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Mi BarberiApp</h1>

      {session ? (
        <>
          <p>Sesión iniciada como:</p>
          <strong>{session.user.email}</strong>

          <div style={{ marginTop: "1rem" }}>
            <button onClick={handleLogout}>Cerrar sesión</button>
          </div>
        </>
      ) : (
        <button onClick={handleLoginWithGoogle}>
          Iniciar sesión con Google
        </button>
      )}
    </main>
  );
}

export default App;