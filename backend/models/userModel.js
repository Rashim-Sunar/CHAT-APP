import mongoose from 'mongoose'
import validator from 'validator'
import bcrypt from 'bcryptjs'

const userSchema = new mongoose.Schema({
    email: {
        type: String,
        required: [true, "EMail field is require"],
        unique: true,
        validate: [validator.isEmail, "Please enter a valid email"]
    },
    userName: {
        type: String,
        minlength: [5, "fullName must be atleast 5 characters"],
        required: true,
    },
    password: {
        type: String,
        required: [true, "Password is reauired field"],
        minlength: [5, "Password must contain atleast 5 characters"],
        select: false
    },
    gender: {
        type: String,
        enum: ['male', 'female', 'ohters'],
        required: true
    },
    profilePic :{
        type: String,
    }
}, {timestamps: true});

userSchema.pre('save', async function(next){
    if(!this.isModified('password'))return next();
    this.password = await bcrypt.hash(this.password, 12);
    next();
});

userSchema.methods.comparePasswordInDB = async function(pass, passInDB){
    return bcrypt.compare(pass, passInDB);
}

const User = mongoose.model("user", userSchema);

export default User;