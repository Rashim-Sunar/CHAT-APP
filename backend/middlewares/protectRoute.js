import jwt from 'jsonwebtoken'

const protectRoute = async(req, res, next) => {
    try {
      const token = req.cookies.jwt;
      if(!token){
        return res.status(401).json({
            status: 'fail',
            message: 'Unathorized - No token provided!'
        });
      }  

      const decoded = await jwt.verify(token, process.env.JWT_SECRET);
      if(!decoded){
        return res.status(401).json({status: 'fail', message: "Unauthorized - Invalid token"});
      }

    //   console.log(decoded);
      req.user = decoded.userId;
      next();

    } catch (error) {
        console.log("Error occured in protectRoute", error.message);
        return res.status(500).json({
            status: 'fail',
            message: "Internal server error"
        });
    }
}


export default protectRoute