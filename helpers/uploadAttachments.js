const multer  = require('multer')
const upload = multer(
    {
        dest: './public/uploads/attachments'
    }
)
const path = require('path')

const mongoose = require('mongoose')
require('../models/Visa')
const Visa = mongoose.model("visa")

module.exports = (multer(
    {
        storage: multer.diskStorage(
            {
                destination: (req, file, cb) => {
                    cb(null, './public/uploads/attachments')
                },
                filename: (req, file, cb) => {
                    const type = file.mimetype
                    const fileExtension = type.split('/').pop();
                    Visa.findOne({_id: req.params.id}).then((visa) => {
                        cb(null, `${Date.now()}-${visa.firstName} ${visa.surname}.${fileExtension}`)
                    })
                }
            }
        )
    }
))