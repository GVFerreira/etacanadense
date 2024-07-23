const express = require('express')
const cors = require('cors')
const app = express()
const session = require("express-session")

const moment = require('moment')

const handlebars = require('express-handlebars')
const handle = handlebars.create({
    defaultLayout: 'main',
    runtimeOptions: {
        allowProtoPropertiesByDefault: true,
        allowProtoMethodsByDefault: true,
    },
    helpers: {
        formatDate: (date) => {
            const dataBanco = new Date(date)
            const dataFormatada = dataBanco.toLocaleString()
            return dataFormatada
            // return moment(date).format('DD/MM/YYYY hh:mm')
        },
        pagination: (page, totalPages, limit, sort) => {
            let output = '';

            const pageNUM = parseInt(page);

            // Adiciona link para a primeira página
            if (pageNUM > 1) {
                output += `
                    <a class="btn btn-secondary" href="/admin?sort=${sort}&limit=${limit}&page=1">&laquo;</a>
                `;
            }

            // Adiciona link para a página anterior
            if (pageNUM > 1) {
                output += `
                    <a class="btn btn-secondary" href="/admin?sort=${sort}&limit=${limit}&page=${pageNUM - 1}">&lsaquo;</a>
                `;
            }

            // Adiciona links para páginas específicas (5 páginas no máximo)
            for (let i = Math.max(1, pageNUM - 2); i <= Math.min(totalPages, pageNUM + 2); i++) {
                const activeClass = i === pageNUM ? 'btn-success' : 'btn-secondary';

                output += `
                    <a class="btn ${activeClass}" href="/admin?sort=${sort}&limit=${limit}&page=${i}">${i}</a>
                `;
            }

            // Adiciona link para a próxima página
            if (pageNUM < totalPages) {
                output += `
                    <a class="btn btn-secondary" href="/admin?sort=${sort}&limit=${limit}&page=${pageNUM + 1}">&rsaquo;</a>
                `;
            }

            // Adiciona link para a última página
            if (pageNUM < totalPages) {
                output += `
                    <a class="btn btn-secondary" href="/admin?sort=${sort}&limit=${limit}&page=${totalPages}">&raquo;</a>
                `;
            }

            return output;
        },
        paginationPayment: (page, totalPages, limit, sort, filter) => {
            let output = ''

            const pageNUM = parseInt(page)

            // Adiciona link para a primeira página
            if (pageNUM > 1) {
                output += `
                    <a class="btn btn-secondary" href="/admin/consult-payments?sort=${sort}&limit=${limit}&filter=${filter}&page=1">&laquo;</a>
                `;
            }

            // Adiciona link para a página anterior
            if (pageNUM > 1) {
                output += `
                    <a class="btn btn-secondary" href="/admin/consult-payments?sort=${sort}&limit=${limit}&filter=${filter}&page=${pageNUM - 1}">&lsaquo;</a>
                `;
            }

            // Adiciona links para páginas específicas (5 páginas no máximo)
            for (let i = Math.max(1, pageNUM - 2); i <= Math.min(totalPages, pageNUM + 2); i++) {
                const activeClass = i === pageNUM ? 'btn-success' : 'btn-secondary';

                output += `
                    <a class="btn ${activeClass}" href="/admin/consult-payments?sort=${sort}&limit=${limit}&filter=${filter}&page=${i}">${i}</a>
                `;
            }

            // Adiciona link para a próxima página
            if (pageNUM < totalPages) {
                output += `
                    <a class="btn btn-secondary" href="/admin/consult-payments?sort=${sort}&limit=${limit}&filter=${filter}&page=${pageNUM + 1}">&rsaquo;</a>
                `;
            }

            // Adiciona link para a última página
            if (pageNUM < totalPages) {
                output += `
                    <a class="btn btn-secondary" href="/admin/consult-payments?sort=${sort}&limit=${limit}&filter=${filter}&page=${totalPages}">&raquo;</a>
                `
            }

            return output
        },
        returnStatusMP: (status) => {
            switch(status) {
                case 'approved':
                    return '<span class="alert-success p-1">Aprovado</span>'

                case 'pending':
                    return '<span class="alert-warning p-1">Pendente</span>'
                
                case 'authorized':
                    return '<span class="alert-warning p-1">Autorizado, aguardando confirmação</span>'

                case 'in_process':
                    return '<span class="alert-warning p-1">Em processamento</span>'
                
                case 'in_mediation':
                    return '<span class="alert-warning p-1">Em análise</span>'

                case 'rejected':
                    return '<span class="alert-danger p-1">Rejeitado</span>'

                case 'cancelled':
                    return '<span class="alert-danger p-1">Cancelado por uma das partes</span>'

                case 'refunded':
                    return '<span class="alert-danger p-1">Reembolsado</span>'

                case 'charged_back':
                    return '<span class="alert-danger p-1">Estornado</span>'
                
                case 'Checkout em andamento':
                    return '<span class="alert-warning p-1">Checkout em andamento</span>'
                
                default:
                    return '<span class="alert-warning p-1">Pendente</span>'

            }
        },
        returnDetailMP: (detail) => {
            switch(detail) {
                case 'accredited':
                    return '<span>Pagamento creditado</span>'

                case 'pending_contingency':
                    return '<span>O pagamento está sendo processado</span>'

                case 'pending_review_manual':
                    return '<span>O pagamento está em análise para determinar sua aprovação ou rejeição.</span>'
                
                case 'cc_rejected_bad_filled_date':
                    return '<span>Data de validade incorreta</span>'

                case 'cc_rejected_bad_filled_other':
                    return '<span>Detalhes incorretos do cartão.</span>'

                case 'cc_rejected_bad_filled_security_code':
                    return '<span>CVV incorreto.</span>'

                case 'cc_rejected_blacklist':
                    return '<span>O cartão está em uma lista negra de roubo/reclamações/fraude.</span>'

                case 'cc_rejected_call_for_authorize':
                    return '<span>O meio de pagamento requer autorização prévia do valor da operação.</span>'

                case 'cc_rejected_card_disabled':
                    return '<span>O cartão está inativo.</span>'

                case 'cc_rejected_duplicated_payment':
                    return '<span>Transação duplicada.</span>'

                case 'cc_rejected_high_risk':
                    return '<span>Rejeição pela prevenção à fraude</span>'

                case 'cc_rejected_insufficient_amount':
                    return '<span>Cartão de crédito sem limite suficiente.</span>'

                case 'cc_rejected_invalid_installments':
                    return '<span>Quantidade de parcelas inválido.</span>'

                case 'cc_rejected_max_attempts':
                    return '<span>Quantidade máxima de tentativas excedida.</span>'

                case 'cc_rejected_other_reason':
                    return '<span>Erro por outros motivos. Consulte a operadora do seu cartão.</span>'

                default:
                    return '<span></span>'
            }
        },
        verifyCodPassport: (codPassport, residentUSCIS, airplane, canadaVisa, nonImmigrateVisa) => {
            const specialCodes = ['ATG (Antígua e Barbuda)', 'BRA (Brasil)']
            let output = ""

            if (specialCodes.includes(codPassport)) {
                residentUSCIS ? output += `<p class="mb-2">Você é um residente permanente legal dos Estados Unidos com um número válido dos Serviços de Cidadania e Imigração dos EUA (USCIS)?</p><p class="d-inline-block alert-success p-1 mb-3">Sim</p>` : output += `<p class="mb-2">Você é um residente permanente legal dos Estados Unidos com um número válido dos Serviços de Cidadania e Imigração dos EUA (USCIS)?</p><p class="d-inline-block alert-danger p-1 mb-3">Não</p>`
                
                airplane ? output += `<p class="mb-2">Você está viajando para o Canadá de avião?</p><p class="d-inline-block alert-success p-1 mb-3">Sim</p>` : output += `<p class="mb-2">Você está viajando para o Canadá de avião?</p><p class="d-inline-block alert-danger p-1 mb-3">Não</p>`

                canadaVisa ? output += `<p class="mb-2">Nos últimos 10 anos, você possuiu um visto canadense de residente temporário válido?</p><p class="d-inline-block alert-success p-1 mb-3">Sim</p>` : output += `<p class="mb-2">Nos últimos 10 anos, você possuiu um visto canadense de residente temporário válido?</p><p class="d-inline-block alert-danger p-1 mb-3">Não</p>`

                nonImmigrateVisa ? output += `<p class="mb-2">Você atualmente possui um visto válido de não-imigrante nos EUA?</p><p class="d-inline-block alert-success p-1 mb-3">Sim</p>` : output += `<p class="mb-2">Você atualmente possui um visto válido de não-imigrante nos EUA?</p><p class="d-inline-block alert-danger p-1 mb-3">Não</p>`
            
            }

            return output
        },
        verifyCodPassportStep: (codPassport, residentUSCIS, airplane, canadaVisa, nonImmigrateVisa) => {
            const specialCodes = ['ATG (Antígua e Barbuda)', 'BRA (Brasil)']
            let output = ""

            if (specialCodes.includes(codPassport)) {
                residentUSCIS ? 
                    output += `
                        <label class="mt-3">Você é um residente permanente legal dos Estados Unidos com um número válido dos Serviços de Cidadania e Imigração dos EUA (USCIS)?</label> 
                        <div class="p-2 w-50 d-flex flex-row gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="residentUSCIS" id="residentUSCIS1" value="0" disabled required>
                                <label class="form-check-label" for="residentUSCIS1">
                                    Não
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="residentUSCIS" id="residentUSCIS2" value="1" checked required>
                                <label class="form-check-label" for="residentUSCIS2">
                                    Sim
                                </label>
                            </div>
                        </div>
                    ` : 
                    output += `
                        <label class="mt-3">Você é um residente permanente legal dos Estados Unidos com um número válido dos Serviços de Cidadania e Imigração dos EUA (USCIS)?</label> 
                        <div class="p-2 w-50 d-flex flex-row gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="residentUSCIS" id="residentUSCIS1" value="0" checked required>
                                <label class="form-check-label" for="residentUSCIS1">
                                    Não
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="residentUSCIS" id="residentUSCIS2" value="1" disabled required>
                                <label class="form-check-label" for="residentUSCIS2">
                                    Sim
                                </label>
                            </div>
                        </div>
                    `
                
                airplane ?
                    output += `
                        <label class="mt-3">Você está viajando para o Canadá de avião?</label>
                        <div class="p-2 w-50 d-flex flex-row gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="airplane" id="airplane1" value="0" disabled required>
                                <label class="form-check-label" for="airplane1">
                                    Não
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="airplane" id="airplane2" value="1" checked required>
                                <label class="form-check-label" for="airplane2">
                                    Sim
                                </label>
                            </div>
                        </div>
                    ` :
                    output += `
                        <label class="mt-3">Você está viajando para o Canadá de avião?</label>
                        <div class="p-2 w-50 d-flex flex-row gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="airplane" id="airplane1" value="0" checked required>
                                <label class="form-check-label" for="airplane1">
                                    Não
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="airplane" id="airplane2" value="1" disabled required>
                                <label class="form-check-label" for="airplane2">
                                    Sim
                                </label>
                            </div>
                        </div>
                    `

                canadaVisa ? 
                    output += `
                        <label class="mt-3">Nos últimos 10 anos, você possuiu um visto canadense de residente temporário válido?</label>
                        <div class="p-2 w-50 d-flex flex-row gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="canadaVisa" id="canadaVisa1" value="0" disabled required>
                                <label class="form-check-label" for="canadaVisa1">
                                    Não
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="canadaVisa" id="canadaVisa2" value="1" checked required>
                                <label class="form-check-label" for="canadaVisa2">
                                    Sim
                                </label>
                            </div>
                        </div>
                    ` :
                    output += `
                        <label class="mt-3">Nos últimos 10 anos, você possuiu um visto canadense de residente temporário válido?</label>
                        <div class="p-2 w-50 d-flex flex-row gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="canadaVisa" id="canadaVisa1" value="0" checked required>
                                <label class="form-check-label" for="canadaVisa1">
                                    Não
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="canadaVisa" id="canadaVisa2" value="1" disabled required>
                                <label class="form-check-label" for="canadaVisa2">
                                    Sim
                                </label>
                            </div>
                        </div>
                    `

                nonImmigrateVisa ?
                    output += `
                        <label class="mt-3">Você atualmente possui um visto válido de não-imigrante nos EUA?</label>
                        <div class="p-2 w-50 d-flex flex-row gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="nonImmigrateVisa" id="nonImmigrateVisa1" value="0" disabled required>
                                <label class="form-check-label" for="nonImmigrateVisa1">
                                    Não
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="nonImmigrateVisa" id="nonImmigrateVisa2" value="1" checked required>
                                <label class="form-check-label" for="nonImmigrateVisa2">
                                    Sim
                                </label>
                            </div>
                        </div>
                    ` :
                    output += `
                        <label class="mt-3">Você atualmente possui um visto válido de não-imigrante nos EUA?</label>
                        <div class="p-2 w-50 d-flex flex-row gap-4">
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="nonImmigrateVisa" id="nonImmigrateVisa1" value="0" checked required>
                                <label class="form-check-label" for="nonImmigrateVisa1">
                                    Não
                                </label>
                            </div>
                            <div class="form-check">
                                <input class="form-check-input" type="radio" name="nonImmigrateVisa" id="nonImmigrateVisa2" value="1" disabled required>
                                <label class="form-check-label" for="nonImmigrateVisa2">
                                    Sim
                                </label>
                            </div>
                        </div>
                    `
            }

            return output
        },
        formatTransactionAmount: (value) => {
            const amount = value || 0
            return amount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
        },
        styleBorderPayment: (status) => {
            switch(status) {
                case 'approved':
                    return 'success'

                case 'pending':
                    return 'warning'
                
                case 'authorized':
                    return 'warning'

                case 'in_process':
                    return 'warning'
                
                case 'in_mediation':
                    return 'warning'

                case 'rejected':
                    return 'danger'

                case 'cancelled':
                    return 'danger'

                case 'refunded':
                    return 'danger'

                case 'charged_back':
                    return 'danger'
                
                default:
                    return 'warning'
            }
        },
        formatPaymentType: (type) => {
            switch (type) {
                case 'bank_transfer':
                    return 'Pix'
                    break
                case 'credit_card':
                    return 'Cartão de crédito'
                    break
                default:
                    return ''
            }
        },
        uniqueVisa: (visas) => {
            if (visas && visas.length > 1) {
                return true
            } else {
                return false
            }
        }
    }
})

const bodyParser = require('body-parser')

const mongoose = require('mongoose')
require('./models/Visa')
const Visa = mongoose.model("visa")
require('./models/Payment')
const Payment = mongoose.model("payment")
require('./models/Session')
const Session = mongoose.model("session")

const nodemailer = require('nodemailer')
const { transporter, handlebarOptions } = require('./helpers/senderMail')
const hbs = require('nodemailer-express-handlebars')

const admin = require('./routes/admin')
const users = require('./routes/users')
const checkout = require('./routes/checkout')

const flash = require("connect-flash")

const path = require('path')

const dotenv = require('dotenv')
require('dotenv').config()

const bcrypt = require('bcryptjs')

const cookieParser = require('cookie-parser')

const cron = require('node-cron')

/***** Tarefa que faz a verificação do checkout abandonado *****/
cron.schedule('*/5 * * * *', async () =>  {
    const payment = await Payment.find({
        status: "Checkout em andamento",
        createdAt: {
            $gt: new Date(Date.now() - 18 * 60 * 1000),
            $lt: new Date(Date.now() - 7 * 60 * 1000)
        }
    }).populate('visaIDs')

    for (const element of payment) {
        transporter.use('compile', hbs(handlebarOptions))

        transporter.sendMail(
            {
                from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                to: element.visaIDs[0].contactEmail,
                bcc: process.env.CANADENSE_RECEIVER_MAIL,
                subject: 'eTA Canadense - Finalize sua aplicação',
                template: 'lembrete',
                context: {
                    fullname: `${element.visaIDs[0].firstName} ${element.visaIDs[0].surname}`,
                    codeETA: element.visaIDs[0].codeETA,
                    transactionid: element._id
                }
            },
            (err, {response, envelope, messageId}) => {
                if(err) {
                    console.error("Lembrete de pagamento: " + new Date())
                    console.error(err)
                } else {
                    console.log({
                        message: "Lembrete de pagamento: " + new Date(),
                        response,
                        envelope,
                        messageId
                    })
                }
            }
        )
    }

    console.log("Script de verifição de checkout abandonado: " + new Date())
})

/*AUTHENTICATION*/
const passport = require("passport")
require("./config/auth")(passport)
const { isAdmin } = require('./helpers/isAdmin')

/*SETTINGS*/
app.use(cors({ origin: 'https://etacanadense.com.br' }))
app.use(express.static(path.join(__dirname, "public")))
app.use(session({
    secret: process.env.CANADENSE_SECRET,
    resave: true,
    saveUninitialized: true,
    cookie: { maxAge: 60 * 60000}
}))
app.use(flash())
app.use(passport.initialize())
app.use(passport.session())


//Handlerbars
app.engine('handlebars', handle.engine)
app.set('view engine', 'handlebars')

//Body Parser
app.use(bodyParser.urlencoded({extended: true}))
app.use(bodyParser.json())

//Middleware
app.use((req, res, next) => {
    res.locals.success_msg = req.flash("success_msg")
    res.locals.error_msg = req.flash("error_msg")
    res.locals.error = req.flash("error")
    res.locals.user = req.user || null
    next()
})

app.use(cookieParser())

app.use((req, res, next) => {
    if (!req.session.aplicacaoStep) {
      req.session.aplicacaoStep = {} // Inicialize o objeto aplicacaoStep
    }
    next()
})

//Mongoose
mongoose.set('strictQuery', true)
mongoose.connect(process.env.CANADENSE_DB_STRING_CONNECT, {
    useNewUrlParser: true,
    useUnifiedTopology: true
}).then(() => {
    console.log("MONGODB CONNECTED")
}).catch((err) => {
    console.log(`Erro: ${err}`)
})

// app.post('/accept-policy', (req, res, next) => {
//     //Setar cookie de aceite de política por 1 ano
//     res.cookie('policyAccepted', true, { maxAge: 31536000000 })
//     res.status(200).json({ message: 'Cookies aceitos com sucesso!' })
// })

app.get('/', async (req, res) => {
    const policyAccepted = req.cookies.policyAccepted
    const showPolicyPopup = !policyAccepted

    const metaDescription = "Garanta sua entrada no Canadá de forma descomplicada e segura com o eTA (Autorização Eletrônica de Viagem). Nosso processo de solicitação online simplifica sua jornada. Solicite seu eTA agora e aproveite uma viagem tranquila ao Canadá"

    res.render('index', {gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", showPolicyPopup, metaDescription})
})

app.get('/aplicacao', async (req, res) => {
    if (!req.query.step) {
        const session = await Session.findOne({session_id: req.sessionID})
        if(!session) {
            const { session_id } = await Session.create({session_id: req.sessionID})
            return res.redirect(`/aplicacao?step=1&session_id=${session_id}`)
        } else {
            return res.redirect(`/aplicacao?step=1&session_id=${req.sessionID}`)
        }
    } else {
        if(req.query.step === '1') {
            const title = "Representante - "
            const metaDescription = 'Inicie o processo de solicitação de Autorização Eletrônica de Viagem para o Canadá. Siga nosso guia passo a passo para obter acesso rápido e fácil a este destino deslumbrante'
    
            if(req.query.again === "true") {
                req.session.aplicacaoStep = {}
                res.render('aplicacao-step1', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", title, data: req.session.aplicacaoStep, metaDescription, session_id: req.sessionID  })
            } else {
                req.session.visas ? req.session.visas.ids = [] : null
                res.render('aplicacao-step1', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", title, data: req.session.aplicacaoStep, metaDescription, session_id: req.sessionID })
            }
        }
    
        if(req.query.step === '2') {
            const sessionData = req.session.aplicacaoStep
            if('representative' in sessionData ) {
                const title = "Validação - "
                res.render('aplicacao-step2', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", title, data: req.session.aplicacaoStep, session_id: req.sessionID })
            } else {
                const { session_id } = await Session.findOne({session_id: req.sessionID})
                if (session_id ) {
                    req.flash('error_msg', 'Os campos na etapa 1 devem ser preenchidos.')
                    res.redirect(`/aplicacao?step=1&session_id=${session_id}`)
                } else {
                    req.flash('error_msg', 'Sua sessão expirou')
                    res.redirect('/aplicacao')
                }
            }
    
        }
    
        if(req.query.step === '3') {
            const sessionData = req.session.aplicacaoStep
            if('document' in sessionData) {
                const title = "Documentos - "
                const { canadaVisa, nonImmigrateVisa } = req.session.aplicacaoStep
                if ((canadaVisa == "0" && nonImmigrateVisa == "1") || (canadaVisa == "1" && nonImmigrateVisa == "1")) {
                    let dynamicData = `
                        <h3 class="mt-4">Dados de não-imigrante</h3>
    
                        <label class="mb-2">Número do visto de não imigrante nos EUA <span class="text-red">* (obrigatório)</span></label>
                        <span class="d-block small mb-2">
                            Confira no botão ao lado
                            <a type="button" data-bs-toggle="modal" data-bs-target="#documentModalNumVisaNonImmigrate">
                                <i class="bi bi-question-circle-fill btn p-0"></i>
                            </a>
                        </span>
                        <input type="text" class="form-control mb-3 w-50" name="numVisaNonImmigrate" id="numVisaNonImmigrate" maxlength="9" value="${sessionData.numVisaNonImmigrate ? sessionData.numVisaNonImmigrate : ""}" required>
    
                        <label class="mb-2" for="dateVisaNonImmigrate">Data de expiração do visto americano de não-imigrante <span class="text-red">* (obrigatório)</span></label>
                        <input type="date" class="form-control mb-3 w-25" name="dateVisaNonImmigrate" id="dateVisaNonImmigrate" onblur="validNotPresentDay(this)" value="${sessionData.dateVisaNonImmigrate ? sessionData.dateVisaNonImmigrate : ""}" required>   
                    `
                    res.render('aplicacao-step3', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", title, dynamicData, data: req.session.aplicacaoStep, session_id: req.sessionID})
                } else {
                    res.render('aplicacao-step3', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", title, dynamicData: '', data: req.session.aplicacaoStep, session_id: req.sessionID})
                }
            } else {
                const { session_id } = await Session.findOne({session_id: req.sessionID})
                if (session_id ) {
                    req.flash('error_msg', 'Os campos na etapa 2 devem ser preenchidos.')
                    res.redirect(`/aplicacao?step=2&session_id=${session_id}`)
                } else {
                    req.flash('error_msg', 'Sua sessão expirou')
                    res.redirect('/aplicacao')
                }
            }
    
        }
    
        if(req.query.step === '4') {
            const sessionData = req.session.aplicacaoStep
            if('numPassport' in sessionData) {
                const title = "Conferência - "
                res.render('aplicacao-step4', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", title, data: req.session.aplicacaoStep, session_id: req.sessionID})
            } else {
                const { session_id } = await Session.findOne({session_id: req.sessionID})
                if (session_id ) {
                    req.flash('error_msg', 'Os campos na etapa 3 devem ser preenchidos.')
                    res.redirect(`/aplicacao?step=3&session_id=${session_id}`)
                } else {
                    req.flash('error_msg', 'Sua sessão expirou')
                    res.redirect('/aplicacao')
                }
            }
        }
    }
})

app.post('/aplicacaoStep1', async (req, res) => {
    const session_id = req.query.session_id
    const session = await Session.findOne({session_id})
    if (session) {
        req.session.aplicacaoStep = Object.assign({}, req.body)
        req.session.aplicacaoStep.representative = parseInt(req.session.aplicacaoStep.representative)
        req.session.aplicacaoStep.representative ? req.session.aplicacaoStep.representativePayed = parseInt(req.session.aplicacaoStep.representativePayed) : 0
        
        res.redirect(`/aplicacao?step=2&session_id=${session_id}`)
    } else {
        req.flash('error_msg', 'Sua sessão expirou')
        res.redirect('/aplicacao')
    }
})

app.post('/aplicacaoStep2', async (req, res) => {
    const session_id = req.query.session_id
    const session = await Session.findOne({session_id})

    if (session) {
        req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
        req.session.aplicacaoStep.residentUSCIS = parseInt(req.session.aplicacaoStep.residentUSCIS)
        req.session.aplicacaoStep.airplane = parseInt(req.session.aplicacaoStep.airplane)
        req.session.aplicacaoStep.canadaVisa = parseInt(req.session.aplicacaoStep.canadaVisa)
        req.session.aplicacaoStep.nonImmigrateVisa = parseInt(req.session.aplicacaoStep.nonImmigrateVisa)

        res.redirect(`/aplicacao?step=3&session_id=${session_id}`)
    } else {
        req.flash('error_msg', 'Sua sessão expirou')
        res.redirect('/aplicacao')
    }
})

app.post('/aplicacaoStep3', async (req, res) => {
    const session_id = req.query.session_id
    const session = await Session.findOne({session_id})

    if (session) {
        req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, req.body)
        req.session.aplicacaoStep.appliedToCanada = parseInt(req.session.aplicacaoStep.appliedToCanada)
        req.session.aplicacaoStep.travelWhen = parseInt(req.session.aplicacaoStep.travelWhen)
        req.session.aplicacaoStep.refusedVisaToCanda = parseInt(req.session.aplicacaoStep.refusedVisaToCanda)
        req.session.aplicacaoStep.criminalOffenceAnywhere = parseInt(req.session.aplicacaoStep.criminalOffenceAnywhere)
        req.session.aplicacaoStep.tuberculosis = parseInt(req.session.aplicacaoStep.tuberculosis)
        res.redirect(`/aplicacao?step=4&session_id=${session_id}`)
    }
    else {
        req.flash('error_msg', 'Sua sessão expirou')
        res.redirect('/aplicacao')
    }  
})

app.post('/aplicacaoStep4', async (req, res) => {
    /* Gera o codeETA, código de acompanhamento da solicitação de eTA. Este código é inserido nos e-mails
    de comunicação e pode ser usado para consultar o status da solicitação */
    const codeSalt = bcrypt.genSaltSync(10);
    const codeETA = codeSalt.substring(10, 15).replace(/[^A-Z a-z 0-9]/g, "X").toUpperCase();

    // Verifica se o código gerado já existe
    const existingCodeETA = await Visa.findOne({ codeETA });

    if (!existingCodeETA) {
        const { agreeCheck, consentAndDeclaration, whichAction } = req.body;

        try {
            const newVisa = new Visa(Object.assign({}, req.session.aplicacaoStep, { agreeCheck, consentAndDeclaration, codeETA }));
            const visaID = newVisa._id;

            let session = await Session.findOne({ session_id: req.query.session_id });

            if (session && session.visa_ids) {
                session = await Session.findOneAndUpdate({ session_id: req.query.session_id }, { $push: { visa_ids: visaID } }, { new: true });
            } else {
                session = await Session.findOneAndUpdate({ session_id: req.query.session_id }, { $set: { visa_ids: [visaID] } }, { new: true });
            }

            // Agrupa as informações em apenas um objeto na sessão
            req.session.aplicacaoStep = Object.assign({}, { visaID }, req.session.aplicacaoStep, { agreeCheck, consentAndDeclaration, codeETA });

            // Salva as informações 
            await newVisa.save();

            // Verifica a ação escolhida pelo usuário. Opções: goToPayment ou newVisa. Ir para pagamento ou Nova solicitação, respectivamente.
            if (whichAction === "goToPayment") {
                function formatTel(numberTel) {
                    return numberTel.replace(/\D/g, '').slice(0, 11);
                }

                if (!req.session.sessionCheckout) {
                    //  Cria um ID da sessão do checkout
                    const checkoutSalt = bcrypt.genSaltSync(10);
                    req.session.sessionCheckout = checkoutSalt;

                    const newClient = await fetch(`${process.env.BASE_URL}/customer`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            "access-token": process.env.APPMAX_ACCESS_TOKEN,
                            "firstname": req.session.aplicacaoStep.firstName,
                            "lastname": req.session.aplicacaoStep.surname,
                            "email": req.session.aplicacaoStep.contactEmail,
                            "telephone": formatTel(req.session.aplicacaoStep.contactTel),
                            "ip": req.ip,
                        })
                    });

                    const client = await newClient.json();

                    if (client.success) {
                        const newPayment = new Payment({
                            idCheckout: checkoutSalt,
                            idClient: client.data.id,
                            status: "Checkout em andamento",
                            visaIDs: session.visa_ids
                        });
                        
                        await newPayment.save();
                    } else {
                        console.log(client);
                    }
                } else {
                    // Se já houver um ID Checkout na sessão, apenas insere o ID da solicitação no registro do pagamento
                    await Payment.findOneAndUpdate(
                        { idCheckout: req.session.sessionCheckout },
                        { $set: { visaIDs: session.visa_ids } }
                    );
                }
            }

            res.status(200).json({ whichAction, session_id: req.query.session_id });
        } catch (err) {
            console.error(err);
            req.flash('error_msg', 'Ocorreu um erro ao salvar seus dados');
            res.status(500).json({ error: 'Ocorreu um erro ao salvar seus dados' });
        }
    } else {
        req.flash("error_msg", "Tente enviar o formulário novamente");
        res.redirect(`/aplicacao?step=4&session_id=${req.sessionID}`);
    }
});

app.get('/acompanhar-solicitacao', (req, res) => {
    const policyAccepted = req.cookies.policyAccepted
    const showPolicyPopup = !policyAccepted
    res.render('acompanhar-solicitacao', {
        gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", 
        showPolicyPopup,
        title: 'Acompanhar solicitação - ',
        metaDescription: 'Acompanhe o status de sua solicitação de eTA em tempo real. Fique atualizado sobre o progresso e a aprovação de sua Autorização Eletrônica de Viagem para o Canadá.'
    })
})

app.post('/consultando-solicitacao', (req, res) => {
    let codeInsert = `${req.body.codeInsert}`.trim()
    if(codeInsert === undefined || codeInsert === null || codeInsert === '') {
        req.flash('error_msg', 'Insira um e-mail ou código')
        res.redirect('/acompanhar-solicitacao')
    } else {
        if (req.body.filtroSelecionado === 'email') {
            codeInsert.toLowerCase()
            Visa.find({contactEmail: codeInsert}).populate('pagamento').then((search_result) => {
                res.render('status-solicitacao', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", search_result })
            })
        } else if (req.body.filtroSelecionado === 'codigo') {
            codeInsert.toUpperCase()
            Visa.find({codeETA: codeInsert}).populate('pagamento').then((search_result) => {
                res.render('status-solicitacao', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", search_result })
            })
        } else if (req.body.filtroSelecionado === 'passaporte') {
            codeInsert.toUpperCase()
            Visa.find({numPassport: codeInsert}).populate('pagamento').then((search_result) => {
                res.render('status-solicitacao', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", search_result })
            })
        }
        
    }
})

app.get('/consulta-download-documento/:filename', (req, res) => {
    res.download(`public/uploads/attachments/${req.params.filename}`)
})

app.get('/contato', (req, res) => {
    const policyAccepted = req.cookies.policyAccepted
    const showPolicyPopup = !policyAccepted
    res.render('contato', {
        gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", 
        showPolicyPopup,
        title: 'Contato - ',
        metaDescription: 'Entre em contato conosco para todas as suas dúvidas e necessidades relacionadas à Autorização Eletrônica de Viagem para o Canadá. Estamos aqui para ajudar a tornar sua viagem o mais tranquila possível.'
    })
})

app.post('/contact-form', (req, res) => {
    transporter.use('compile', hbs(handlebarOptions))

    const mailOptions = {
        from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
        to: process.env.CANADENSE_RECEIVER_MAIL,
        subject: 'Formulário de Contato',
        template: 'contato',
        context: {
            name: req.body.name,
            email: req.body.email,
            message: req.body.message
        }
    }

    transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
        if(err) {
            console.log("Formulário de contato: " + new Date())
            console.log(err)
            req.flash('error_msg', `Houve um erro ao enviar este formulário: ${err}`)
            res.redirect('/contato')
        } else {
            console.log({
                message: `Formulário de contato: ${new Date()}`,
                response, envelope, messageId})
            req.flash('success_msg', `Formulário enviado com sucesso. Em breve nossa equipe entrará em contato.`)
            res.redirect('/contato')
        }
    })
})

app.get('/cadastur', (req, res) => {
    res.render('cadastur', { gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", title: 'Cadastur - '})
})

app.get('/artigos', (req, res) => {
    const policyAccepted = req.cookies.policyAccepted
    const showPolicyPopup = !policyAccepted
    res.render('artigos', {
        gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", 
        showPolicyPopup,
        title: 'Artigos - ',
        metaDescription: 'Explore nosso catálogo de artigos informativos sobre viagens ao Canadá, Autorização Eletrônica de Viagem e dicas úteis para uma visita perfeita.'
    })
})

app.get('/politica-privacidade', (req, res) => {
    const policyAccepted = req.cookies.policyAccepted
    const showPolicyPopup = !policyAccepted
    res.render('politica-privacidade', {
        gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", 
        showPolicyPopup,
        title: 'Politica de privacidade - ',
        metaDescription: 'Saiba como protegemos seus dados pessoais. Leia nossa Política de Privacidade para entender nosso compromisso com a segurança e a confidencialidade.'
    })
})

app.get('/termos-condicoes', (req, res) => {
    const policyAccepted = req.cookies.policyAccepted
    const showPolicyPopup = !policyAccepted
    res.render('termos-condicoes', {
        gtm: "<!-- Google Tag Manager --><script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','GTM-WMFR7925');</script><!-- End Google Tag Manager -->", 
        showPolicyPopup,
        title: 'Termos e Condições - ',
        metaDescription: 'Conheça nossos Termos e Condições para solicitação e uso da Autorização Eletrônica de Viagem para o Canadá. Garanta que sua viagem esteja em conformidade com as regras e regulamentos'
    })
})

app.use('/admin', isAdmin, admin)
app.use('/users', users)
app.use('/checkout', checkout)

app.use((req, res) => {
    res.status(404).render("erro404", {title: "Error 404 - "})
})

const PORT = process.env.PORT || 3030
app.listen(PORT, ()=> {
    console.log("SERVER ON! PORT: " + PORT)
})
