import { BiLogOut } from "react-icons/bi";
import useLogout from "../../hooks/useLogout.js";

const LogoutButton = () => {
	const {loading, logout} = useLogout();

	return (
		<div className="mt-auto">
		{!loading ? (
			<BiLogOut className="text-white w-6 h-6 cursor-pointer hover:scale-105" onClick={logout}/>
		) : (
			<span className="loading loading-spinner loading-lg"></span>
		)
		}
		</div>
	);
};
export default LogoutButton;


//STARTER CODE GOES HERE.....
// import { BiLogOut } from "react-icons/bi";

// const LogoutButton = () => {

// 	return (
// 		<div className="mt-auto">
// 			<BiLogOut className="text-white w-6 h-6 cursor-pointer hover:scale-105"/>
// 		</div>
// 	);
// };
// export default LogoutButton;