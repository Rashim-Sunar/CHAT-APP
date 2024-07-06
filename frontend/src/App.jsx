import './App.css'
import "./index.css"
import Login from "./pages/login/Login.jsx"
import Home from "./pages/home/Home.jsx"
import {Routes, Route, Navigate} from 'react-router-dom'
import SignUp from './pages/signup/Signup.jsx'
import {Toaster} from 'react-hot-toast';
import { useAuthContext } from './context/Auth-Context.jsx'


function App() {

  const {authUser} = useAuthContext();

  return (
    <div className='p-4 h-screen flex items-center justify-center'>
      <Toaster/>
        <Routes>
            <Route path="/login" element = {authUser ? <Navigate to="/"/> : <Login/>} />
            <Route path='/signup' element = {authUser ? <Navigate to="/"/> : <SignUp/>} />
            <Route path='/' element = {authUser ? <Home/> : <Navigate to="/login"/>}/>
        </Routes>
    </div>
  )
}

export default App
