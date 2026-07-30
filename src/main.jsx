import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import App from "./App.jsx";
import BuildingsDashboard from "./ops-tasks-dashboard.jsx";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/buildings/:id" element={<BuildingsDashboard />} />
        <Route path="/buildings"     element={<BuildingsDashboard />} />
        <Route path="/*"             element={<App />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
