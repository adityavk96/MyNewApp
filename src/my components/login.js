import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../firebaseConfig';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';

const Login = () => {
  const [isLoginView, setIsLoginView] = useState(true);
  const navigate = useNavigate(); // For redirecting after login

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Registration state
  const [regName, setRegName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPassword, setRegPassword] = useState('');

  const toggleView = () => {
    setIsLoginView(!isLoginView);
    // Reset all fields
    setLoginEmail('');
    setLoginPassword('');
    setRegName('');
    setRegEmail('');
    setRegPassword('');
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    try {
      await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      console.log(`User logged in successfully with email: ${loginEmail}`);
      navigate('/main'); // Redirect to Main page
    } catch (error) {
      console.error("Firebase Auth Error:", error.code, error.message);
      switch (error.code) {
        case 'auth/user-not-found':
          alert('No account found with this email.');
          break;
        case 'auth/wrong-password':
          alert('Incorrect password.');
          break;
        case 'auth/invalid-email':
          alert('Invalid email format.');
          break;
        default:
          alert(error.message);
      }
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, regEmail, regPassword);
      const user = userCredential.user;

      await setDoc(doc(db, 'users', user.uid), {
        name: regName,
        email: regEmail,
      });

      console.log(`User "${regName}" created successfully with email: ${regEmail}`);
      alert('Account created successfully!');
      setIsLoginView(true); // Switch to login view
    } catch (error) {
      console.error("Firebase Auth Error:", error.code, error.message);
      switch (error.code) {
        case 'auth/email-already-in-use':
          alert('This email is already registered. Please login.');
          break;
        case 'auth/invalid-email':
          alert('Invalid email format.');
          break;
        case 'auth/weak-password':
          alert('Password should be at least 6 characters.');
          break;
        default:
          alert(error.message);
      }
    }
  };

  return (
    <main className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="w-full max-w-md p-8 space-y-8 bg-white rounded-xl shadow-lg">
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
          {isLoginView ? 'Sign in to your account' : 'Create a new account'}
        </h2>

        {isLoginView ? (
          <form className="space-y-6" onSubmit={handleLogin}>
            <div>
              <label htmlFor="login-email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="login-email"
                type="email"
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label htmlFor="login-password" className="block text-sm font-medium text-gray-700">Password</label>
              <input
                id="login-password"
                type="password"
                value={loginPassword}
                onChange={(e) => setLoginPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md">Sign In</button>
          </form>
        ) : (
          <form className="space-y-6" onSubmit={handleRegister}>
            <div>
              <label htmlFor="reg-name" className="block text-sm font-medium text-gray-700">Full Name</label>
              <input
                id="reg-name"
                type="text"
                value={regName}
                onChange={(e) => setRegName(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label htmlFor="reg-email" className="block text-sm font-medium text-gray-700">Email</label>
              <input
                id="reg-email"
                type="email"
                value={regEmail}
                onChange={(e) => setRegEmail(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <div>
              <label htmlFor="reg-password" className="block text-sm font-medium text-gray-700">Password</label>
              <input
                id="reg-password"
                type="password"
                value={regPassword}
                onChange={(e) => setRegPassword(e.target.value)}
                required
                className="w-full px-3 py-2 border rounded-md"
              />
            </div>
            <button type="submit" className="w-full py-2 bg-blue-600 text-white rounded-md">Create Account</button>
          </form>
        )}

        <div className="text-sm text-center">
          <button onClick={toggleView} className="text-blue-600 hover:text-blue-500">
            {isLoginView ? "Don't have an account? Register" : 'Already have an account? Sign in'}
          </button>
        </div>
      </div>
    </main>
  );
};

export default Login;
