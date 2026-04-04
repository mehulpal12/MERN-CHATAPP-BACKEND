import multer from 'multer'
import { CloudinaryStorage } from 'multer-storage-cloudinary'
import cloudinary from '../config/cloudinary.js'

const storage = new CloudinaryStorage({
    cloudinary:cloudinary,
    params:{
        folder:'chat-app',
        allowed_formats:['jpg','jpeg','png','gif'],
        transformation:[{width:800,height:600,crop:'limit'},
            {
                quality:'auto'
            }
            
        ],
    } as any,
})

export const upload = multer({
    storage:storage,
     limits:{
        fileSize:1024*1024*5,
     },
     fileFilter:(req,file,cb)=>{
        if(file.mimetype.startsWith('image/')){
            cb(null,true)
        }else{
            cb(new Error('Invalid file type only image is allow'))
        }
     }
})