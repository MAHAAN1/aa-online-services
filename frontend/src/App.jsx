import {
  BrowserRouter,
  Routes,
  Route,
} from "react-router-dom";

import Home from "./pages/Home";
import PrintOrder from "./pages/PrintOrder";
import TrackOrder from "./pages/TrackOrder";
import Enquiry from "./pages/Enquiry";
import Services from "./pages/Services";
import Application from "./pages/Application";
import Admin from "./pages/Admin";
import AdminLogin from "./pages/AdminLogin";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* CUSTOMER */}
        <Route
          path="/"
          element={<Home />}
        />

        <Route
          path="/print"
          element={<PrintOrder />}
        />

        <Route
          path="/track"
          element={<TrackOrder />}
        />

        <Route
          path="/enquiry"
          element={<Enquiry />}
        />

        <Route
          path="/services"
          element={<Services />}
        />

        <Route
          path="/application"
          element={<Application />}
        />

        {/* ADMIN */}
        <Route
          path="/admin/login"
          element={<AdminLogin />}
        />

        <Route
          path="/admin"
          element={<Admin />}
        />

        {/* FALLBACK */}
        <Route
          path="*"
          element={<Home />}
        />
      </Routes>
    </BrowserRouter>
  );
}