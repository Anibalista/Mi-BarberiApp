import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import App from "./App.jsx";
import { validateEnv } from "./config/env";
import { AuthProvider } from "./context/AuthContext.jsx";
import "./index.css";

validateEnv();

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>
);