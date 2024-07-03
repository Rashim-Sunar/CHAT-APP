import User from '../models/userModel.js'
import generateToken from '../Utils/generateToken.js'

export const signUpUser = async (req, res) => {
  try {
    const {password, confirmPassword} = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Password and confirmPassword not matching",
      });
    }
      const newUser = await User.create(req.body);
      //Generating token to login user....
      generateToken(newUser._id, res);

      res.status(200).json({
        status: 'success',
        data: {
            user: newUser
        }
      });
  } catch (error) {
    console.log("Some error occured in signUpUser", error.message);
  }

  //For default profile pics..
  //https://avatar.plcaeholder.iran.liara.run/ const boyProfile ="" , const girlProfile=""
};

export const loginUser = (req, res) => {
  console.log("User loggedin");
};

export const logOutUser = (req, res) => {
  console.log("USer logged Out");
};
