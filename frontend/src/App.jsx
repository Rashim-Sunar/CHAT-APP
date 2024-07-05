import './App.css'
import "./index.css"
import Login from "./pages/login/Login.jsx"
import Signup from "./pages/signup/Signup.jsx"
import Home from "./pages/home/Home.jsx"


function App() {

  return (
    <div className='p-4 h-screen flex items-center justify-center'>
        {/* <Login/>   */}
        {/* <Signup/> */}
        <Home/>
    </div>
  )
}

export default App
