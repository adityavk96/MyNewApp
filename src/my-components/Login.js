import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { auth } from "../firebaseConfig";
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
} from "firebase/auth";

const Login = ({ onLogin }) => {
  const navigate = useNavigate();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState(""); // For registration
  const [message, setMessage] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (onLogin)
          onLogin({
            email: user.email,
            displayName: user.displayName,
          });
        setMessage("🎉 Login successful!");
        navigate("/");
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName });
        setMessage("✅ Registration successful! Please login.");
        setIsLogin(true);
        setEmail("");
        setPassword("");
        setDisplayName("");
      }
    } catch (error) {
      if (error.code === "auth/invalid-credential") {
        setMessage("User not registered, please register.");
      } else {
        setMessage(error.message);
      }
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-r from-purple-400 via-pink-500 to-red-500 p-6">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8">
        <h2 className="text-3xl font-bold text-center mb-6 text-purple-700">
          {isLogin ? "Login" : "Register"}
        </h2>

        <form onSubmit={handleSubmit} className="space-y-5">
          {!isLogin && (
            <div>
              <label htmlFor="displayName" className="block mb-1 font-semibold text-gray-700">
                Full Name
              </label>
              <input
                id="displayName"
                type="text"
                placeholder="Full Name"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                required
                className="w-full px-4 py-2 rounded-md border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
            </div>
          )}
          <div>
            <label htmlFor="email" className="block mb-1 font-semibold text-gray-700">
              Email address
            </label>
            <input
              id="email"
              type="email"
              placeholder="Email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-md border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <div>
            <label htmlFor="password" className="block mb-1 font-semibold text-gray-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full px-4 py-2 rounded-md border border-purple-300 focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
          </div>
          <button
            type="submit"
            className="w-full py-3 bg-purple-600 text-white rounded-md font-semibold hover:bg-purple-700 transition"
          >
            {isLogin ? "Login" : "Register"}
          </button>
        </form>
        {message && (
          <p className={`mt-4 text-center ${message.toLowerCase().includes("successful") ? "text-green-600" : "text-red-600"} font-medium`}>
            {message}
          </p>
        )}
        <p className="mt-6 text-center text-gray-600">
          {isLogin ? "Don't have an account?" : "Already have an account?"}{" "}
          <button
            onClick={() => {
              setIsLogin(!isLogin);
              setMessage("");
              setEmail("");
              setPassword("");
              setDisplayName("");
            }}
            className="text-purple-700 font-semibold hover:underline focus:outline-none"
          >
            {isLogin ? "Register here" : "Login here"}
          </button>
        </p>
      </div>
    </div>
  );
};

export default Login;
