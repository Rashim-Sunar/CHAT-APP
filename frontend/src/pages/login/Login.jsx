import React, { useState } from "react";
import { Link } from "react-router-dom";
import useLogin from "../../hooks/useLogin.js";

const Login = () => {
  const [inputs, setInputs] = useState({
    email: "",
    password: "",
  });

  const { loading, login } = useLogin();

  const handleChange = (event) => {
    setInputs((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    await login(inputs);
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6">
      
      {/* Card */}
      <div className="w-full max-w-3xl bg-white rounded-3xl 
                      shadow-[0_20px_60px_rgba(0,0,0,0.08)]
                      p-6 sm:p-10 md:p-12 transition-all duration-300">

        {/* Header */}
        <div className="text-center mb-8 sm:mb-10">
          <h1 className="text-3xl sm:text-4xl md:text-5xl 
                         font-bold text-slate-800 tracking-tight">
            Welcome Back
          </h1>

          <p className="text-slate-500 mt-3 text-base sm:text-lg">
            Sign in to continue to{" "}
            <span className="text-indigo-600 font-semibold">
              ChatApp
            </span>
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6 sm:space-y-8 max-w-2xl mx-auto">

          {/* Email */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Email
            </label>
            <input
              type="email"
              name="email"
              value={inputs.email}
              onChange={handleChange}
              placeholder="you@example.com"
              className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl 
                         bg-white text-slate-800
                         border border-slate-300
                         focus:outline-none 
                         focus:ring-2 focus:ring-indigo-500
                         focus:border-indigo-500
                         transition duration-200"
              required
            />
          </div>

          {/* Password */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">
              Password
            </label>
            <input
              type="password"
              name="password"
              value={inputs.password}
              onChange={handleChange}
              placeholder="Enter your password"
              className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl 
                         bg-white text-slate-800
                         border border-slate-300
                         focus:outline-none 
                         focus:ring-2 focus:ring-indigo-500
                         focus:border-indigo-500
                         transition duration-200"
              required
            />
          </div>

          {/* Signup Link */}
          <div className="flex justify-start">
            <Link
              to="/signup"
              className="text-sm text-slate-500 hover:text-indigo-600 transition"
            >
              Don’t have an account?
            </Link>
          </div>

          {/* Button */}
          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 sm:h-14 rounded-xl font-semibold text-white
                       bg-indigo-600 hover:bg-indigo-700
                       transition-all duration-300
                       active:scale-[0.98]
                       shadow-md disabled:opacity-70"
          >
            {!loading ? "Login" : "Signing in..."}
          </button>
        </form>
      </div>
    </div>
  );
};

export default Login;
