import React, { useEffect, useState } from 'react';
import { auth, db } from '../firebaseConfig';
import { useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';

const Main = () => {
  const [userName, setUserName] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const navigate = useNavigate();

  // Fetch user info from Firestore
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
          setUserName(userSnap.data().name || '');
          setUserEmail(userSnap.data().email || '');
        }
      } else {
        setUserName('');
        setUserEmail('');
      }
    });

    return () => unsubscribe();
  }, []);

  const handleLogout = async () => {
    await auth.signOut();
    navigate('/'); // redirect to login page
  };

  const goToProfile = () => {
    navigate('/profile');
  };

  return (
    <main className="relative flex flex-col min-h-screen w-full bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 p-4">
      {/* Top-right avatar (only if user logged in) */}
      {userName && (
        <div className="absolute top-4 right-4">
          <button
            className="w-10 h-10 rounded-full bg-orange-500 text-white flex items-center justify-center font-bold"
            onClick={() => setDropdownOpen(!dropdownOpen)}
          >
            {userName.charAt(0).toUpperCase()}
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-white shadow-lg rounded-md overflow-hidden z-50">
              <div className="px-4 py-2 border-b">
                <p className="font-medium text-gray-800">{userName}</p>
                <p className="text-sm text-gray-500">{userEmail}</p>
              </div>
              <button
                onClick={goToProfile}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                Profile
              </button>
              <button
                onClick={handleLogout}
                className="w-full text-left px-4 py-2 hover:bg-gray-100"
              >
                Logout
              </button>
            </div>
          )}
        </div>
      )}

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <h1 className="text-4xl font-bold text-white">
          Welcome {userName || 'Guest'}!
        </h1>
        <p className="mt-4 text-lg text-white/90">
          This is a minimalist application with a side menu.
        </p>
      </div>
    </main>
  );
};

export default Main;
