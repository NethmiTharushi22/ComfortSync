import { Navigate, Route, Routes } from "react-router-dom";

import Dashboard from "./pages/Dashboard";
import ChatPage from "./pages/ChatPage";
import TemperaturePage from "./pages/TemperaturePage";
import HumidityPage from "./pages/HumidityPage";
import GasPage from "./pages/GasPage";
import DustPage from "./pages/DustPage";
import LightPage from "./pages/LightPage";

function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/chat" element={<ChatPage />} />
      <Route path="/sensors/temperature" element={<TemperaturePage />} />
      <Route path="/sensors/humidity" element={<HumidityPage />} />
      <Route path="/sensors/gas" element={<GasPage />} />
      <Route path="/sensors/dust" element={<DustPage />} />
      <Route path="/sensors/light" element={<LightPage />} />
    </Routes>
  );
}

export default App;
