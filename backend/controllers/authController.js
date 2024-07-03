import User from "../models/userModel.js";
import generateToken from "../Utils/generateToken.js";

export const signUpUser = async (req, res) => {
  try {
    const { password, confirmPassword } = req.body;

    if (password !== confirmPassword) {
      return res.status(400).json({
        status: "fail",
        message: "Password and confirmPassword not matching",
      });
    }
    //https://avatar.iran.liara.run/public/boy

    if(!req.body.profilePic){
      if(req.body.gender === 'male'){
        req.body.profilePic = `https://avatar.iran.liara.run/public/boy?username=${req.body.userName}`;
      }else{
        req.body.profilePic = `https://avatar.iran.liara.run/public/girl?username=${req.body.userName}`;
      }
    }

    const newUser = await User.create(req.body);
    //Generating token to login user....
    generateToken(newUser._id, res);

    res.status(200).json({
      status: "success",
      data: {
        user: newUser,
      },
    });
  } catch (error) {
    console.log("Some error occured in signUpUser", error.message);
    res.status(500).json({
      status: 'fail',
      messgae: "Internal server error"
    })
  }

  //For default profile pics..
  //https://avatar.plcaeholder.iran.liara.run/ const boyProfile ="" , const girlProfile=""

};

export const loginUser = async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select("+password");
    if (!user || !(await user.comparePasswordInDB(password, user.password))) {
      return res.status(400).json({
        status: "fail",
        message: "User with the email and password not found",
      });
    }

    generateToken(user._id, res);

    res.status(200).json({
      status: "success",
      data: {
        user,
      },
    });
  } catch (error) {
    console.log("Error occured in login user", error.message);
    res.status(500).json({
      status: 'fail',
      message: "Internal server error"
    });
  }
};


//TO logout user just expire the jwt...
export const logOutUser = (req, res) => {
  try{
    res.cookie("jwt", "", {maxAge: 0});
    res.status(200).json({
      status: 'success',
      message: "User looged out successfully"
    });
  }catch(error){
    console.log("Error occured while logging out", error.message);
    res.status(500).json({
      status: 'fail',
      message: "Internal server error"
    })
  }
};
