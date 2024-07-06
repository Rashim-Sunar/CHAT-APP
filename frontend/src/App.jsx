import './App.css'
import "./index.css"
import Login from "./pages/login/Login.jsx"
import Home from "./pages/home/Home.jsx"
import {Routes, Route} from 'react-router-dom'
import SignUp from './pages/signup/Signup.jsx'
import {Toaster} from 'react-hot-toast';


function App() {

  return (
    <div className='p-4 h-screen flex items-center justify-center'>
      <Toaster/>
        <Routes>
            <Route path="/" element = {<Login/>} />
            <Route path='/signup' element = {<SignUp/>} />
            <Route path='/home' element = {<Home/>}/>
        </Routes>
    </div>
  )
}

export default App
