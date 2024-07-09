import React, { useState } from 'react'
import {Link} from 'react-router-dom'
import useLogin from '../../hooks/useLogin.js';

const Login = () => {
	const [inputs, setInputs] = useState({
		email: "",
		password: ""
	});

	const {loading, login} = useLogin();

	const handleChange = (event) => {
		setInputs(val => ({...val, [event.target.name] : event.target.value}));
	}

	const handleSubmit = async(event) => {
		event.preventDefault();
		await login(inputs);
	}

    	return (
    		<div className='flex flex-col items-center justify-center min-w-96 mx-auto'>
    			<div className='w-full p-6 rounded-lg shadow-md bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-lg bg-opacity-0'>
    				<h1 className='text-3xl font-semibold text-center text-gray-300'>
    					Login
    					<span className='text-blue-500'> ChatApp</span>
    				</h1>
    
    				<form onSubmit={handleSubmit}>
    					<div>
    						<label className='label p-2'>
    							<span className='text-base label-text'>Email</span>
    						</label>
    						<input type='email' name='email' value={inputs.email || ""} onChange={handleChange} placeholder='Enter user email' className='w-full input input-bordered h-10' />
    					</div>
    
    					<div>
    						<label className='label'>
    							<span className='text-base label-text'>Password</span>
    						</label>
    						<input
    							type='password'
								name='password'
								value={inputs.value}
								onChange={handleChange}
    							placeholder='Enter Password'
    							className='w-full input input-bordered h-10'
    						/>
    					</div>
    					<Link to="/signup" className='text-sm  hover:underline hover:text-blue-600 mt-2 inline-block'>
    						{"Don't"} have an account?
    					</Link>
    
    					<div>
    						<button className='btn btn-block btn-sm mt-2'
							disabled={loading}>
								{!loading ? "Login" : (<span className='loading loading-spinner loading-md'></span>)} 
							</button>
    					</div>
    				</form>
    			</div>
    		</div>
    	);
    };
    export default Login;



// STARTER CODE FOR FRONTEND
/*
    const Login = () => {
    	return (
    		<div className='flex flex-col items-center justify-center min-w-96 mx-auto'>
    			<div className='w-full p-6 rounded-lg shadow-md bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-lg bg-opacity-0'>
    				<h1 className='text-3xl font-semibold text-center text-gray-300'>
    					Login
    					<span className='text-blue-500'> ChatApp</span>
    				</h1>
    
    				<form>
    					<div>
    						<label className='label p-2'>
    							<span className='text-base label-text'>Username</span>
    						</label>
    						<input type='text' placeholder='Enter username' className='w-full input input-bordered h-10' />
    					</div>
    
    					<div>
    						<label className='label'>
    							<span className='text-base label-text'>Password</span>
    						</label>
    						<input
    							type='password'
    							placeholder='Enter Password'
    							className='w-full input input-bordered h-10'
    						/>
    					</div>
    					<a href='#' className='text-sm  hover:underline hover:text-blue-600 mt-2 inline-block'>
    						{"Don't"} have an account?
    					</a>
    
    					<div>
    						<button className='btn btn-block btn-sm mt-2'>Login</button>
    					</div>
    				</form>
    			</div>
    		</div>
    	);
    };
    export default Login; */