import React from 'react';
import { Link } from 'react-router-dom'; // Import Link
import { Menu } from 'lucide-react';

const SideMenu = ({ isOpen, toggleMenu, user }) => {
  // Construct menu items. Hide Login if user is logged in.
  const menuItems = [
    // Only show Login if no user is logged in
    ...(!user ? [{ name: 'Login', path: '/login' }] : []),
    { name: 'Home', path: '/' },
    { name: 'Services', path: '/services' },
  ];

  return (
    <>
      {/* This is the main menu that slides in */}
      <aside
        className={`fixed top-0 left-0 h-full w-64 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 transform transition-transform duration-300 ease-in-out z-40 shadow-lg ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="p-4 mt-20 flex flex-col space-y-4">
          {menuItems.map((item) => (
            <Link
              key={item.name}
              to={item.path}
              onClick={toggleMenu}
              className="text-left px-4 py-3 bg-gray-200 hover:bg-gray-300 rounded-lg font-semibold transition-colors duration-300 shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              {item.name}
            </Link>
          ))}
        </div>
      </aside>

      {/* This button is always visible to toggle the menu */}
      <button
        onClick={toggleMenu}
        className="fixed top-4 left-4 z-50 p-2 rounded-full bg-gray-200 hover:bg-gray-300 transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        <Menu className="w-6 h-6 text-gray-600" />
      </button>
    </>
  );
};

export default SideMenu;
