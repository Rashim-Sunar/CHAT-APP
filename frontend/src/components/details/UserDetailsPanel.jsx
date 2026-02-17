const UserDetailsPanel = () => {
  return (
    <div className="w-full h-full p-6 flex flex-col">
      
      <div className="text-center mb-6">
        <div className="w-20 h-20 mx-auto bg-slate-300 rounded-full mb-3"></div>
        <h3 className="font-semibold text-slate-800">
          User Details
        </h3>
      </div>

      <div className="text-sm text-slate-500 space-y-2">
        <p>Shared images will appear here.</p>
        <p>Shared links will appear here.</p>
        <p>Other user info will appear here.</p>
      </div>

    </div>
  );
};

export default UserDetailsPanel;
