const express = require('express')
router = express.Router()
const mongoose = require('mongoose')
    require('../models/User')
const User = mongoose.model("users")
    require('../models/Visa')
const Visa = mongoose.model("visa")
const nodemailer = require('nodemailer')
const { transporter, handlebarOptions } = require('../helpers/senderMail')
const hbs = require('nodemailer-express-handlebars')
const bcrypt = require('bcryptjs')
const multer = require('multer')
const path = require("path")
const { connect } = require('http2')
require('dotenv').config()

router.get('/', (req, res) => {
    Visa.find().then((visas) => {
        res.render('admin/index', { visas })
    }).catch((err) => {
        req.flash('error_msg', 'Ocorreu um erro ao listar todos as solicitações')
        res.redirect('/')
    })
})


module.exports = router