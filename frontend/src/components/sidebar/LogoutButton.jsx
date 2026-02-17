import { BiLogOut } from "react-icons/bi";
import useLogout from "../../hooks/useLogout";

const LogoutButton = () => {
  const { loading, logout } = useLogout();

  return (
    <button
      onClick={logout}
      disabled={loading}
      className="flex items-center gap-2 text-red-500 
                 hover:text-red-700 transition duration-200"
    >
      <BiLogOut className="w-5 h-5" />
      <span className="text-md">Logout</span>
    </button>
  );
};

export default LogoutButton;
