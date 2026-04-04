import "./App.css";
import "./index.css";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import Login from "./pages/login/Login";
import Home from "./pages/home/Home";
import SignUp from "./pages/signup/Signup";
import { useAuthContext } from "./context/Auth-Context";

function App() {
  const { authUser } = useAuthContext();

  return (
    <div className="p-4 h-screen flex items-center justify-center">
      <Toaster />
      <Routes>
        <Route path="/login" element={authUser ? <Navigate to="/" /> : <Login />} />
        <Route path="/signup" element={authUser ? <Navigate to="/" /> : <SignUp />} />
        <Route path="/" element={authUser ? <Home /> : <Navigate to="/login" />} />
      </Routes>
    </div>
  );
}

export default App;