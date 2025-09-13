import React, { useState } from 'react';

const Header = ({ user, onLogout }) => {
  const [dropdownOpen, setDropdownOpen] = useState(false);

  if (!user) {
    // No user logged in: Show header without avatar
    return (
      <header className="w-full p-4 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 flex justify-end relative">
        {/* You can add a login button here if needed */}
      </header>
    );
  }

  const userName = user.name || "User";
  const userInitial = userName.charAt(0).toUpperCase();

  return (
    <header className="w-full p-4 bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 flex justify-end relative">
      {/* Avatar Button */}
      <button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold focus:outline-none"
        aria-label="User menu"
      >
        {userInitial}
      </button>

      {/* Dropdown menu */}
      {dropdownOpen && (
        <div className="absolute right-4 mt-12 w-44 bg-white rounded-md shadow-lg z-50">
          <div className="px-4 py-2 border-b text-gray-800 font-medium">
            {userName}
            <div className="text-sm text-gray-500">{user.email || "N/A"}</div>
          </div>

          <button
            type="button"
            className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            onClick={() => {
              setDropdownOpen(false);
              // Add profile navigation logic here
            }}
          >
            Profile
          </button>
          <button
            type="button"
            className="block w-full text-left px-4 py-2 hover:bg-gray-100"
            onClick={() => {
              setDropdownOpen(false);
              if (onLogout) onLogout();
            }}
          >
            Logout
          </button>
        </div>
      )}
    </header>
  );
};

export default Header;
