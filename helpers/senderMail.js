const nodemailer = require('nodemailer')
const path = require("path")
require('dotenv').config()

module.exports = {
    transporter: nodemailer.createTransport({
        host: process.env.HOSTNAME_MAIL,
        port: process.env.PORT_MAIL,
        auth: {
            user: process.env.USER_MAIL,
            pass: process.env.USER_MAIL_PASS
        },
    }),
    handlebarOptions: {
        viewEngine: {
        partialsDir: path.join(__dirname, '..', 'views/email'),
        defaultLayout: false,
        },
        viewPath: path.join(__dirname, '..', 'views/email'),
    }
}