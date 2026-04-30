import mongoose , { Document,Schema} from "mongoose";

export interface IUser extends Document {
    name: string;
    email: string;
    
}

const userSchema : Schema<IUser> = new Schema({
    name: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true,
        index: true,
    }
}, {
    timestamps: true
});

const User = mongoose.model<IUser>("User", userSchema);
export default User;
