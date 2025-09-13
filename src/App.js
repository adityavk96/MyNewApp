import React, { useState } from "react";
import { Routes, Route, useNavigate } from "react-router-dom";
import Header from "./my components/header";
import Main from "./my components/main";
import Services from "./my components/Services";
import SideMenu from "./my components/SideMenu";
import Login from "./my components/Login";
import GstRecoPage from "./my components/GstReco";
import ProtectedRoute from "./my components/ProtectedRoute";
import "./App.css";

function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [user, setUser] = useState(null);

  const navigate = useNavigate();

  const toggleMenu = () => setIsMenuOpen(!isMenuOpen);

  const handleLogin = (loggedInUser) => {
    const userName = loggedInUser.displayName || loggedInUser.name || loggedInUser.email;
    setUser({ ...loggedInUser, name: userName });
    navigate("/");
  };

  const handleLogout = () => {
    setUser(null);
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-white">
      <SideMenu isOpen={isMenuOpen} toggleMenu={toggleMenu} user={user} />
      {isMenuOpen && (
        <div
          onClick={toggleMenu}
          className="fixed inset-0 bg-blue opacity-50 z-30 lg:hidden"
        />
      )}
      <div
        className={`flex flex-col transition-all duration-300 ease-in-out ${
          isMenuOpen ? "pl-64" : "pl-0"
        }`}
      >
        <Header user={user} onLogout={handleLogout} />
        <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/services" element={<Services />} />
          <Route
            path="/gst-reco"
            element={
              <ProtectedRoute user={user}>
                <GstRecoPage />
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<Login onLogin={handleLogin} />} />
        </Routes>
      </div>
    </div>
  );
}

export default App;
