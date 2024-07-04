import User from '../models/userModel.js'

export const getUsersForSidebar = async(req, res) => {
    try{
        const loggedinUserId = req.user; //We get this from the middleware

        const filteredUsers = await User.find({ _id: {$ne: loggedinUserId}});
        res.status(200).json({
            status: 'success',
            users: filteredUsers.length,
            data: {
                users: filteredUsers
            }
        });

    }catch(error){
        console.log("Error in getUserForSidebar", error.message);
        res.status(500).json({
            status: 'fail',
            message: 'Internal server error'
        });
    }
}