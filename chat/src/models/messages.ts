import mongoose , {Document, Schema, Types} from "mongoose"

export interface IMessage extends Document{
    chatId: Types.ObjectId;
    sender:string;
    text?:string;
    image?:{
        url: string;
        publicId:string;
    };
    messageType:"text"|"image";
    seen:boolean;
    seenAt?:Date;
    createdAt:Date;
    updatedAt:Date;
    
}

const schema = new Schema<IMessage>({
    chatId:{
        type: Schema.Types.ObjectId,
        ref:"Chat",
        required:true,
        index:true
    },
    sender:{
        type:String,
        required:true
    },
    text:{
        type:String,
    },
    image:{
        url:String,
        publicId:String
    },
    messageType:{
        type:String,
        enum:["text","image"],
        required:true
    },
    seen:{
        type:Boolean,
        default:false,
        index:true
    },
    seenAt:{
        type:Date,
        default:null
    },
   
}, 
{timestamps:true}
)



export const Messages = mongoose.model<IMessage>("Message",schema);