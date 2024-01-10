const express = require('express')
router = express.Router()

const mongoose = require('mongoose')
    require('../models/User')
const User = mongoose.model("users")
    require('../models/Visa')
const Visa = mongoose.model("visa")
    require('../models/Payment')
const Payment = mongoose.model("payment")

const nodemailer = require('nodemailer')
const { transporter, handlebarOptions } = require('../helpers/senderMail')
const hbs = require('nodemailer-express-handlebars')

const bcrypt = require('bcryptjs')
const multer = require('multer')
const path = require("path")
const { connect } = require('http2')
const uploadAttach = require('../helpers/uploadAttachments')

const PDFPrinter = require("pdfmake")

require('dotenv').config()

router.get('/', async (req, res) => {
    const page = req.query.page || 1
    const sort = req.query.sort || "DESC"
    const limit = req.query.limit || 20
    const filter = req.query.filter || ''
    const visasPerPage = limit
    const skip = (page - 1) * visasPerPage

    const totalVisas = await Visa.countDocuments()

    if(filter) {
        Visa.find({numPassport: filter}).populate('pagamento').sort({createdAt: sort}).skip(skip).limit(limit).then((visas) => {
            const totalPages = Math.ceil(totalVisas / visasPerPage)
            res.render('admin/index', {visas, limit, sort, page, filter, totalPages, totalVisas, title: 'Administrativo - '})
        }).catch((err) => {
            req.flash('error_msg', 'Ocorreu um erro ao listar todos as solicitações')
            res.redirect('/')
        })
    } else {
        Visa.find().populate('pagamento').sort({createdAt: sort}).skip(skip).limit(limit).then((visas) => {
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

router.get('/details-visa/:id', (req, res) => {

    Visa.findOne({_id: req.params.id}).then((visa) => {
        const fonts = {
            Helvetica: {
                normal: 'Helvetica',
                bold: 'Helvetica-Bold',
                italics: 'Helvetica-Oblique',
                bolditalics: 'Helvetica-BoldOblique'
            }
        }
    
        const printer = new PDFPrinter(fonts)

        // Formatações
        function formatarData(dataString) {
            const [ano, mes, dia] = dataString.split("-");
            return `${dia}/${mes}/${ano}`;
        }

        function formatarGenero(genero) {
            switch (genero) {
                case 'male':
                    return 'Masculino'
                break
                case 'female':
                    return 'Feminino'
                break
                case 'other':
                    return 'Outro'
                break
            }
        }

        function formatarEstadoCivil(estadoCivil) {
            switch (estadoCivil) {
                case '0':
                    return 'Casado'
                    break
                case '2':
                    return 'Divorciado'
                    break
                case '3':
                    return 'Casamento anulado'
                    break
                case '4':
                    return 'Viúvo(a)'
                    break
                case '5':
                    return 'União estável'
                    break
                case '6':
                    return 'Nunca casou / Solteiro'
                    break
            }
        }

        function formatarProfissao(profissao) {
            switch (profissao) {
                case 1: return 'Ocupações artísticas, culturais, recreativas e desportivas'
                break
                case 2: return 'Ocupações de negócios, finanças e administração'
                break
                case 3: return 'Educação, direito e ocupações de serviços sociais, comunitários e governamentais'
                break
                case 4: return 'Ocupações de saúde'
                break
                case 5: return 'Dona de casa'
                break
                case 6: return 'Ocupações de gestão'
                break
                case 7: return 'Ocupações de manufatura e serviços públicos'
                break
                case 8: return 'Forças militares/armadas'
                break
                case 9: return 'Ciências naturais e aplicadas e ocupações relacionadas'
                break
                case 10: return 'Recursos naturais, agricultura e ocupações de produção relacionadas'
                break
                case 11: return 'Aposentado'
                break
                case 12: return 'Ocupações de vendas e serviços'
                break
                case 13: return 'Estudante'
                break
                case 14: return 'Operadores de comércio, transporte e equipamentos e ocupações relacionadas'
                break
                case 15: return 'Desempregado'
                break
            }
        }
    
        const docDefinitions = {
            defaultStyle: { font: "Helvetica"},
            header: [
                {
                    image: "./public/img/logo-details.png",
                    width: 90,
                    margin: 10,
                    alignment: 'right'
                },
                {
                    text: 'Teste'
                }
            ],
            content: [
                {
                    stack:[
                        { text: 'Informações enviadas para aplicação do eTA Canadense', fontSize: 18, bold: true, alignment: 'center', margin: [0, 0, 0, 15] },
                        {
                            stack: [
                                {
                                    text: visa.representative ? "Detalhes do responsável ou representante\n\n" : "",
                                    style: 'subheader'
                                },
                                {
                                    text:  visa.representative ? `Aplicado por: ${visa.representativeRelationship}\n
                                            Pago para representar o requerente e preencher o formulário em seu nome? ${visa.representativePayed ? "Sim" : "Não"}\n
                                            Representado por: ${visa.representativeName} ${visa.representativeSurname}\n
                                            Nome da empresa: ${visa.representativeOrgName}\n
                                            Endereço: ${visa.representativeAddress}\n
                                            Código postal: ${visa.representativeCodpostal}\n
                                            Contato: ${visa.representativeEmail} | ${visa.representativeNumTel}\n
                                            Número de identificação de membro: ${visa.representativeNumIDmebro}\n
                                            Província ou território: ${visa.representativeProvOrTer}\n
                                        ` : ''
                                }
                            ]
                        },
                        {
                            stack: [
                                { text: "Perguntas de validação\n\n", style: 'subheader' },
                                { text: `Qual documento de viagem você pretende usar para viajar ao Canadá?\nPassaporte - comum/regular\n\n` },
                                { text: `Código que corresponde ao do seu passaporte: ${visa.codPassport}\n\n` },
                                { text: [
                                        'Residente permanente legal dos Estados Unidos com um número válido dos Serviços de Cidadania e Imigração dos EUA (USCIS)? ',
                                        `${visa.residentUSCIS ? "Sim\n\n" : "Não\n\n"}`
                                    ]
                                },
                                { text: [
                                        'Nacionalidade indicada neste passaporte: ',
                                        `${visa.nationalityPassport}\n\n`
                                    ]
                                },
                                {
                                    text: [
                                        'Está viajando para o Canadá de avião? ',
                                        `${visa.airplane ? "Sim\n\n" : "Não\n\n"}`
                                    ]
                                },
                                {
                                    text: [
                                        'Possuiu um visto canadense de residente temporário válido nos últimos 10 anos? ',
                                        `${visa.canadaVisa ? "Sim\n\n" : "Não\n\n"}`
                                    ]
                                },
                                {
                                    text: [
                                        'Atualmente possui um visto válido de não-imigrante nos EUA? ',
                                        `${visa.nonImmigrateVisa ? "Sim\n\n" : "Não\n\n"}`
                                    ]
                                }
                            ]
                        },
                        {
                            stack: [
                                {
                                    text: visa.nonImmigrateVisa ? "Dados de não-imigrante\n\n" : "",
                                    style: 'subheader'
                                },
                                {
                                    text: visa.nonImmigrateVisa ? `Número do visto de não imigrante nos EUA: ${visa.numVisaNonImmigrate}\n
                                    Data de expiração do visto americano de não-imigrante: ${formatarData(visa.dateVisaNonImmigrate)}\n\n` : ""
                                }
                            ]
                        },
                        {
                            stack: [
                                {
                                    text: "Dados do passaporte do requerente\n\n",
                                    style: 'subheader'
                                },
                                { text: `Número do passaporte: ${visa.numPassport}\n\n` },
                                { text: `Data de emissão do passaporte: ${formatarData(visa.doiPassport)}\n\n` },
                                { text: `Data de expiração do passaporte: ${formatarData(visa.doePassport)}\n\n` },
                                { text: `Nome completo: ${visa.firstName} ${visa.surname}\n\n` },
                                { text: `Data de nascimento: ${formatarData(visa.dateBirthday)}\n\n` },
                                { text: `Gênero: ${formatarGenero(visa.gender)}\n\n` },
                                { text: `Cidade/município de nascimento: ${visa.cityBirth}\n\n` },
                                { text: `País/território de nascimento: ${visa.countryBirth}\n\n` }
                            ]
                        },
                        {
                            stack: [
                                {
                                    text: "Dados pessoais do requerente\n\n",
                                    style: 'subheader'
                                },
                                { text: visa.nationalitiesExtra ? `Nacionalidade adicional: ${visa.nationalitiesExtra}\n\n` : "" },
                                { text: `Estado civil: ${formatarEstadoCivil(visa.maritalStatus)}\n\n` },
                                { text: `já solicitou ou obteve um visto, um eTA ou uma permissão para visitar, morar, trabalhar ou estudar no Canadá? ${visa.appliedToCanada ? "Sim\n\n" : "Não\n\n"}`},
                                { text: visa.appliedToCanada ? `Identificador exclusivo do cliente (UCI) / visto canadense anterior, eTA ou número de permissão: ${visa.personalUCI ? "Sim\n\n" : "Não\n\n"}` : "" }
                            ]
                        },
                        {
                            stack: [
                                {
                                    text: "Informação de emprego\n\n",
                                    style: 'subheader'
                                },
                                { text: `Profissão: ${formatarProfissao(visa.occupation)}` }
                            ]
                        }
                    ],
                    margin: [10, 20]
                },
            ],
            footer: (currentPage, pageCount) => { 
                const contador = currentPage.toString() + ' de ' + pageCount
                const dataAtual = new Date()
    
                const dia = dataAtual.getDate()
                const mes = dataAtual.getMonth() + 1
                const ano = dataAtual.getFullYear()
                const hora = dataAtual.getHours()
                const minutos = dataAtual.getMinutes()
    
                const dataHora = `${dia}/${mes}/${ano} ${hora}:${minutos}`
                return [
                    { text: contador, style: 'footer'},
                    { text: `${dataHora}`, alignment: 'right', margin: [10,0] }
                ]
            },
            styles: {
                header: {
                    fontSize: 15,
                    bold: true
                },
                subheader: {
                    fontSize: 11,
                    margin: [0, 7],
                    bold: true
                },
                footer: {
                  alignment: 'center'
                }
            }
        }
    
        const pdfDoc = printer.createPdfKitDocument(docDefinitions)
    
        const chunks = []
        pdfDoc.on("data", (chunk) => {
            chunks.push(chunk)
        })
    
        pdfDoc.end()
    
        pdfDoc.on("end", () => {
            const result = Buffer.concat(chunks)
            res.end(result)
        })
    }).catch((err) => {
        req.flash("error_msg", "Falha ao carregar o PDF: " + err)
        res.redirect('/admin')
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

router.get('/consult-payments', async (req, res) => {
    try {
        const pagamentos = await Payment.find().populate('visaIDs').sort({ createdAt: 1 })

        res.render('admin/consult-payments', { pagamentos, title: "Consulta de pagamentos - " })
    } catch (error) {
        console.error(error)
        res.status(500).send('Erro ao consultar pagamentos')
    }
})

router.post('/create-payments', async (req, res) => {
    try {
        // Obtém todos os documentos da coleção "visas"
        const visas = await Visa.find()

        // Itera sobre cada documento e verifica se o pagamento já existe antes de criar um novo
        for (const visa of visas) {
            if (visa.idPayment) {

                // Verifica se já existe um pagamento com base no campo "idPayment"
                const existingPayment = await Payment.findOne({ transactionId: visa.idPayment })

                if (!existingPayment) {
                    // Faz uma chamada à API do Mercado Pago para obter informações adicionais sobre o pagamento
                    const response = await fetch(`https://api.mercadopago.com/v1/payments/${visa.idPayment}`, {
                        method: "GET",
                        headers: {
                            Authorization: `Bearer ${process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN}`
                        }
                    });

                    // Converte a resposta para JSON
                    const paymentData = await response.json()

                    // Cria um novo registro na coleção "payments" com base nas informações obtidas
                    const payment = await Payment.create({
                        transaction_amount: paymentData.transaction_amount,
                        transactionId: visa.idPayment,
                        status: paymentData.status,
                        status_details: paymentData.status_detail,
                        payment_type_id: paymentData.payment_type_id,
                        installments: paymentData.installments,
                        qrCode: paymentData.qrCode || '',
                        qrCodeBase64: paymentData.qrCodeBase64 || '',
                        visaIDs: [visa._id],
                    })

                    // Atualiza o campo "pagamento" no documento Visa com o _id do pagamento criado
                    await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: payment._id } })
                } else {
                    // Se o pagamento já existir, adiciona o _id do Visa ao array visaIDs
                    existingPayment.visaIDs.push(visa._id)
                    await existingPayment.save()
                }
            }
        }

        res.status(200).send('Registros de pagamento criados/atualizados com sucesso.')
    } catch (err) {
        console.error(err)
        res.status(500).send('Erro ao criar/atualizar registros de pagamento.')
    }
});




module.exports = router