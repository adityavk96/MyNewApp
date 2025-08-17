import React, { useState } from 'react';
import { Routes, Route } from 'react-router-dom'; // Import Routes and Route
import Header from './my components/header';
import Main from './my components/main'; // This will be our Home page
import Services from './my components/Services'; // Import the new Services page
import SideMenu from './my components/SideMenu';
import Login from './my components/login';
import GstReconciliation from './my components/GstReconciliation';
import './App.css';
import GstReco2B from './my components/GstReco'; // Import the GSTR 2B component


function App() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);

  const toggleMenu = () => {
    setIsMenuOpen(!isMenuOpen);
  };

  return (
    <div className="min-h-screen bg-white">
      <SideMenu isOpen={isMenuOpen} toggleMenu={toggleMenu} />
      
      {/* Overlay for mobile */}
      {isMenuOpen && (
        <div 
          onClick={toggleMenu} 
          className="fixed inset-0 bg-blue opacity-50 z-30 lg:hidden"
        ></div>
      )}

      {/* Main Content Wrapper */}
      <div 
        className={`flex flex-col transition-all duration-300 ease-in-out ${
          isMenuOpen ? 'pl-64' : 'pl-0'
        }`}
      >
        <Header />
       <Routes>
          <Route path="/" element={<Main />} />
          <Route path="/services" element={<Services />} />
          <Route path="/login" element={<Login />} />
          <Route path="/gst-reconciliation" element={<GstReconciliation />} />
          <Route path="/gst-reco" element={<GstReco2B />} />
          {/* You can add an About page route here later */}
          {/* <Route path="/about" element={<About />} /> */}
        </Routes>
      </div>
    </div>
  );
}

export default App;