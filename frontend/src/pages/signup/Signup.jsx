import React, { useState } from "react";
import GenderCheckbox from "./GenderCheckbox";
import {Link} from 'react-router-dom'
import useSignup from "../../hooks/useSignup";

const SignUp = () => {
	const [inputs, setInputs] = useState({
		email: "",
		userName: "",
		password: "",
		confirmPassword: "",
		gender: ""
	});

	const {loading, signup} = useSignup();

	const handleInputsChange = (event) => {
		setInputs((val) => ({...val, [event.target.name] : event.target.value }))
	}

	const hanldeSubmit = async(event) => {
		event.preventDefault();
		// console.log(inputs);
		await signup(inputs);
	}

	const handleCheckboxChange = (gender) => {
		setInputs((val) => ({...val, gender: gender}))
	}
	return (
		<div className='flex flex-col items-center justify-center min-w-96 mx-auto'>
			<div className='w-full p-6 rounded-lg shadow-md bg-gray-400 bg-clip-padding backdrop-filter backdrop-blur-lg bg-opacity-0'>
				<h1 className='text-3xl font-semibold text-center text-gray-300'>
					Sign Up <span className='text-blue-500'> ChatApp</span>
				</h1>

				<form onSubmit={hanldeSubmit}>
					<div>
						<label className='label p-2'>
							<span className='text-base label-text'>Email</span>
						</label>
						<input type='email' placeholder='johndoe123@gmail.com' name="email" value={inputs.email || ''} onChange={handleInputsChange} className='w-full input input-bordered  h-10' />
					</div>

					<div>
						<label className='label p-2 '>
							<span className='text-base label-text'>userName</span>
						</label>
						<input type='text' placeholder='johndoe' name="userName" value={inputs.userName || ''}  onChange={handleInputsChange} className='w-full input input-bordered h-10' />
					</div>

					<div>
						<label className='label'>
							<span className='text-base label-text'>Password</span>
						</label>
						<input
							type='password'
							placeholder='Enter Password'
							name="password"
							value={inputs.password || ''}
							onChange={handleInputsChange}
							className='w-full input input-bordered h-10'
						/>
					</div>

					<div>
						<label className='label'>
							<span className='text-base label-text'>Confirm Password</span>
						</label>
						<input
							type='password'
							placeholder='Confirm Password'
							name="confirmPassword"
							value={inputs.confirmPassword || ''}
							onChange={handleInputsChange}
							className='w-full input input-bordered h-10'
						/>
					</div>

					<GenderCheckbox handleCheckboxChange={handleCheckboxChange} selectedGender={inputs.gender}/>

					<Link to="/" className='text-sm hover:underline hover:text-blue-600 mt-2 inline-block'>
						Already have an account?
					</Link>

					<div>
						<button className='btn btn-block btn-sm mt-2 border border-slate-700'
						 disabled = {loading}> {/*button is disabled is loading state is true*/}
							{loading ? (<span className="loading loading-spinner"></span>) : "Sign Up"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
};
export default SignUp;