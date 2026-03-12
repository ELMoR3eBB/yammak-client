import React from "react";
import ReactDOM from "react-dom/client";

import "primereact/resources/themes/lara-light-indigo/theme.css"; // theme
import "primereact/resources/primereact.min.css";                // core styles
import "primeicons/primeicons.css";                              // icons

import { PrimeReactProvider } from "primereact/api";
import App from "./App";

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <PrimeReactProvider
      value={{
        ripple: true,
        // optional; helps some overlays
        appendTo: "self",
      }}
    >
      <App />
    </PrimeReactProvider>
  </React.StrictMode>
);
