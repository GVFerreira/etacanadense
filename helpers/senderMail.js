const nodemailer = require('nodemailer')
const handlebars = require('express-handlebars')
const path = require("path")
const fs = require("fs")
require('dotenv').config()

module.exports = {
    transporter: nodemailer.createTransport({
        host: 'smtp.gmail.com',
        port: '587',
        secure: false,
        auth: {
            user: process.env.USER_MAIL,
            pass: process.env.USER_MAIL_PASS
        }
    }),
    handlebarOptions: {
        viewEngine: {
            partialsDir: path.join(__dirname, '..', 'views/email'),
            defaultLayout: false
        },
        viewPath: path.join(__dirname, '..', 'views/email')
    }
}