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
const uploadAttach = require('../helpers/uploadAttachments')
require('dotenv').config()

router.get('/', async (req, res) => {
    const page = req.query.page || 1
    const sort = req.query.sort || "DESC"
    const limit = req.query.limit || 10
    const filter = req.query.filter || ''
    const visasPerPage = limit
    const skip = (page - 1) * visasPerPage

    const totalVisas = await Visa.countDocuments()

    if(filter) {
        Visa.find({numPassport: filter}).sort({createdAt: sort}).skip(skip).limit(limit).then((visas) => {
            const totalPages = Math.ceil(totalVisas / visasPerPage)
            res.render('admin/index', {visas, limit, sort, page, filter, totalPages, totalVisas, title: 'Administrativo - '})
        }).catch((err) => {
            req.flash('error_msg', 'Ocorreu um erro ao listar todos as solicitações')
            res.redirect('/')
        })
    } else {
        Visa.find().sort({createdAt: sort}).skip(skip).limit(limit).then((visas) => {
            const totalPages = Math.ceil(totalVisas / visasPerPage)
            res.render('admin/index', {visas, limit, sort, page, totalPages, totalVisas, title: 'Administrativo - '})
        }).catch((err) => {
            req.flash('error_msg', 'Ocorreu um erro ao listar todos as solicitações')
            res.redirect('/')
        })
    }
})

router.get("/register-user", (req, res) => {
    res.render("admin/register-user")
})

router.post("/registering-user", (req, res) => {
    let errors = []

    if(!req.body.name || typeof !req.body.name == undefined || req.body.name == null) {
        errors.push({text: "Nome inválido"})
    }

    if(!req.body.email || typeof !req.body.email == undefined || req.body.email == null) {
        errors.push({text: "E-mail inválido"})
    }

    if(req.body.password.length < 4) {
        errors.push({text: "Senha muito curta"})
    }

    if(req.body.password != req.body.password2) {
        errors.push({text: "As senhas não são iguais"})
    }

    if(errors.length > 0) {
        res.render("admin/register-user", {errors: errors})
    }else {
        User.findOne({email: req.body.email}).then((user) => {
            if(user) {
                req.flash("error_msg", "E-mail já cadastrado")
                res.redirect("/admin/register-user")
            } else{
                const email = req.body.email.toLowerCase()
                const newUser = new User({
                    name:  req.body.name,
                    email,
                    password: req.body.password
                })

                //criptografar senha
                bcrypt.genSalt(10, (error, salt) => {
                    bcrypt.hash(newUser.password, salt, (error, hash) => {
                        if(error){
                            req.flash("error_msg", "Houve um erro durante o registro do usuário")
                            res.redirect("/admin")
                        } 

                        newUser.password = hash

                        newUser.save().then(() => {
                            req.flash("success_msg", "Usuário registrado com sucesso")
                            res.redirect("/admin/consult-users")
                        }).catch(() => {
                            req.flash("error_msg", "Houve um erro ao registrar o usário")
                            res.redirect("/admin")
                        })
                    })
                })
            }
        }).catch((err) => {
            req.flash("error_msg", `Houve um erro interno: ${err}`)
            res.redirect("/admin/consult-users")
        })
    }
})

router.get('/consult-users', (req, res) => {
    User.find().sort({createdAt: 'DESC'}).then((users) => {
        res.render('admin/consult-users', {users: users})
    }).catch((err) => {
        req.flash('error_msg', `Houve um erro ao listar os usuários ${err}`)
        res.redirect('/admin')
    })
})

router.get('/edit-user/:id', (req, res) => {
    User.findOne({_id: req.params.id}).then((user) => {
        res.render('admin/edit-user', {user: user})
    }).catch((err) => {
        req.flash('error_msg', 'Houve um erro ao carregar o usuário a ser editado')
        res.redirect('/admin/consult-users')
    })
})

router.post('/editing-user', (req, res) => {
    User.findOne({_id: req.body.id}).then((user) => {
        user.name = req.body.name
        user.email = req.body.email
        user.password = req.body.password
        user.password2 = req.body.password2
        
        let errors = []

        if(user.password != user.password2) {
            errors.push({text: 'As senhas digitadas não coincidem'})
        }

        if(errors.length > 0) {
            res.render('admin/edit-user', {errors: errors, user: user})
        } else {
            bcrypt.genSalt(10, (error, salt) => {
                bcrypt.hash(user.password, salt, (err, hash) => {
                    if(err){
                        req.flash("error_msg", `Houve um erro durante o registro do usuário: ${err}`)
                        res.redirect("/admin")
                    } 
    
                    user.password = hash
    
                    user.save().then(() => {
                        req.flash("success_msg", "Usuário registrado com sucesso")
                        res.redirect('/admin/consult-users')
                    }).catch((err) => {
                        req.flash("error_msg", `Houve um erro ao registrar o seu usuário: ${err}` )
                        res.redirect('/admin')
                    })
                })
            })
        }
  
    }).catch((err) => {
            req.flash('error_msg', `Não foi possível encontrar esse usuário: ${err}` )
            res.redirect('/admin/consult-users')
    })
})

router.get('/delete-user/:id', (req, res) => {
    User.findByIdAndDelete({_id: req.params.id}).then(() => {
        req.flash('success_msg', 'Cadastro do usuário excluído com sucesso')
        res.redirect('/admin/consult-users')
    }).catch((err) => {
        req.flash('error_msg', `Ocorreu um erro: ${err}`)
        res.render('admin/consult-users')
    })
})

router.post('/edit-visa/:id', uploadAttach.array('attachments'), (req, res) => {
    Visa.findOne({_id: req.params.id}).then((visa) => {
        visa.statusETA = req.body.statusETA
        visa.attachments = req.files

        transporter.use('compile', hbs(handlebarOptions))

        const subject = `${visa.firstName} ${visa.surname} - ${visa.numPassport}`.toUpperCase()
        const mailOptions = {
            from: `eTA Canadense <${process.env.USER_MAIL}>`,
            to: visa.contactEmail,
            replyTo: process.env.USER_MAIL,
            subject,
            template: req.body.statusETA === 'Aprovado'? 'documento': 'documento-negado',
            attachments: req.files,
            context: {
                clientName: visa.firstName,
                codeETA: visa.codeETA
            }
        }

        transporter.sendMail(mailOptions, (err, info) => {
            if(err) {
                console.log(err)
            } else {
                console.log(info)
            }
        })
        
        visa.save().then(() => {
            req.flash("success_msg", "Aplicação atualizada com sucesso")
            res.redirect('/admin')
        }).catch((err) => {
            req.flash("error_msg", `Houve um erro ao atualizar a aplicação. Erro: ${err}` )
            res.redirect('/admin')
        })
    }).catch((err) => {
        req.flash('error_msg', `Houve um erro ao atualizar a aplicação. Erro: ${err}`)
        res.redirect('/admin')
    })
})

router.get('/delete-visa/:id', (req, res) => {
    Visa.findByIdAndDelete({_id: req.params.id}).then(() => {
        req.flash('success_msg', 'Solicitação excluída com sucesso')
        res.redirect('/admin')
    }).catch((err) => {
        req.flash('error_msg', `Ocorreu um erro: ${err}`)
        res.redirect('/admin')
    })
})


module.exports = router