import React from 'react'

function GenderCheckbox({handleCheckboxChange, selectedGender}) {
  return (
    <div className='flex'>
			<div className='form-control'>
 				<label className={`label gap-2 cursor-pointer ${selectedGender === 'male' ? 'male' : ''}`}>
 					<span className='label-text'>Male</span>
 					<input type='checkbox' className='checkbox border-slate-900' checked={selectedGender==='male'} onChange={() => handleCheckboxChange("male")}/>
 				</label>
 			</div>
 			<div className='form-control'>
 				<label className={`label gap-2 cursor-pointer ${selectedGender === 'female' ? 'feamle' : ''}`}>
 					<span className='label-text'>Female</span>
 					<input type='checkbox' className='checkbox border-slate-900' checked = {selectedGender==='female'} onChange={() => handleCheckboxChange("female")}/>
 				</label>
 			</div>
 		</div>
  )
}

export default GenderCheckbox




// STARTER CODE FOR THIS FILE
// const GenderCheckbox = () => {
// 	return (
// 		<div className='flex'>
// 			<div className='form-control'>
// 				<label className={`label gap-2 cursor-pointer`}>
// 					<span className='label-text'>Male</span>
// 					<input type='checkbox' className='checkbox border-slate-900' />
// 				</label>
// 			</div>
// 			<div className='form-control'>
// 				<label className={`label gap-2 cursor-pointer`}>
// 					<span className='label-text'>Female</span>
// 					<input type='checkbox' className='checkbox border-slate-900' />
// 				</label>
// 			</div>
// 		</div>
// 	);
// };
// export default GenderCheckbox;