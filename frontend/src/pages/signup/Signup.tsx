import { useState, type ChangeEvent, type FormEvent } from "react";
import { Link } from "react-router-dom";
import useSignup from "../../hooks/useSignup";
import GenderCheckbox from "./GenderCheckbox";
import type { SignupCredentials } from "../../types";

const SignUp = () => {
  const [inputs, setInputs] = useState<SignupCredentials>({
    email: "",
    userName: "",
    password: "",
    confirmPassword: "",
    gender: "",
  });

  const { loading, signup } = useSignup();

  const handleInputsChange = (event: ChangeEvent<HTMLInputElement>) => {
    setInputs((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    await signup(inputs);
  };

  const handleCheckboxChange = (gender: "male" | "female") => {
    setInputs((prev) => ({
      ...prev,
      gender,
    }));
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 sm:px-6">
      <div
        className="w-full max-w-4xl bg-white rounded-3xl
                      shadow-[0_25px_70px_rgba(0,0,0,0.08)]
                      p-6 sm:p-10 md:p-14 transition-all duration-300"
      >
        <div className="text-center mb-8 sm:mb-12">
          <h1 className="text-3xl sm:text-4xl md:text-5xl font-bold text-slate-800">
            Create Account
          </h1>

          <p className="text-slate-500 mt-3 text-base sm:text-lg">
            Join <span className="text-indigo-600 font-semibold">ChatApp</span> and start chatting
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-8 sm:space-y-10 max-w-3xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Email</label>
              <input
                type="email"
                name="email"
                value={inputs.email}
                onChange={handleInputsChange}
                placeholder="johndoe@gmail.com"
                className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl 
                           bg-white text-slate-800
                           border border-slate-300
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           focus:border-indigo-500 transition duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Username</label>
              <input
                type="text"
                name="userName"
                value={inputs.userName}
                onChange={handleInputsChange}
                placeholder="johndoe"
                className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl 
                           bg-white text-slate-800
                           border border-slate-300
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           focus:border-indigo-500 transition duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">Password</label>
              <input
                type="password"
                name="password"
                value={inputs.password}
                onChange={handleInputsChange}
                placeholder="Enter password"
                className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl 
                           bg-white text-slate-800
                           border border-slate-300
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           focus:border-indigo-500 transition duration-200"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">
                Confirm Password
              </label>
              <input
                type="password"
                name="confirmPassword"
                value={inputs.confirmPassword}
                onChange={handleInputsChange}
                placeholder="Confirm password"
                className="w-full h-12 sm:h-14 px-4 sm:px-6 rounded-xl 
                           bg-white text-slate-800
                           border border-slate-300
                           focus:outline-none focus:ring-2 focus:ring-indigo-500
                           focus:border-indigo-500 transition duration-200"
                required
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-4">Gender</label>

            <GenderCheckbox
              handleCheckboxChange={handleCheckboxChange}
              selectedGender={inputs.gender}
            />

            <div className="mt-4">
              <Link to="/" className="text-sm text-slate-500 hover:text-indigo-600 transition">
                Already have an account?
              </Link>
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full h-12 sm:h-14 rounded-xl font-semibold text-white
                       bg-indigo-600 hover:bg-indigo-700
                       transition-all duration-300
                       active:scale-[0.98]
                       shadow-md disabled:opacity-70"
          >
            {!loading ? "Create Account" : "Signing up..."}
          </button>
        </form>
      </div>
    </div>
  );
};

export default SignUp;