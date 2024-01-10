const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
require('../models/Visa')
const Visa = mongoose.model("visa")
require('../models/Payment')
const Payment = mongoose.model("payment")
const mercadopago = require('mercadopago')
const dotenv = require('dotenv')
dotenv.config()
const bodyParser = require('body-parser')
router.use(bodyParser.urlencoded({extended: true}))
router.use(bodyParser.json())

const nodemailer = require('nodemailer')
const { transporter, handlebarOptions } = require('../helpers/senderMail')
const hbs = require('nodemailer-express-handlebars')

const mercadoPagoPublicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY
if (!mercadoPagoPublicKey) {
  console.log("Error: public key not defined")
  process.exit(1)
}

const mercadoPagoAccessToken = process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN
if (!mercadoPagoAccessToken) {
  console.log("Error: access token not defined")
  process.exit(1)
}

mercadopago.configurations.setAccessToken(mercadoPagoAccessToken)

mercadopago.configure({
  access_token: process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN,
  sandbox: true
})

router.get('/', (req, res) => {
  const sessionaData = req.session.aplicacaoStep

  if('visaID' in sessionaData) {
    const title = 'Checkout - '
    const data = req.session.aplicacaoStep
    const publicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY
    const visas = req.session.visas.ids
    const qtyVisas = visas.length
    res.render('checkout/index', {title, mercadoPagoAccessToken, data, publicKey, visas, qtyVisas})
  } else {
    req.flash('error_msg', 'Os campos na etapa 4 devem ser preenchidos.')
    res.redirect(`/aplicacao?etapa=4`)
  }
})

router.get('/retry/:idPayment', async (req, res) => {
  const title = 'Checkout - '
  const publicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY
  const visa = await Visa.findOne({idPayment: req.params.idPayment})

  res.render('checkout/retry', {visa, title, publicKey})
})

router.post('/process-payment', (req, res) => {
  const { body } = req
  const { payer } = body

  const visas = req.session.visas.ids
  const qtyVisas = visas.length

  mercadopago.payment.create({
    transaction_amount: qtyVisas * 147.00,
    token: body.token,
    description: 'Solicitação de Autorização de Viagem - Canadá',
    installments: Number(body.installments),
    payment_method_id: body.paymentMethodId,
    issuer_id: body.issuerId,
    notification_url: "https://etacanadense.com.br/checkout/webhooks?source_news=webhook",
    payer: {
      email: payer.email,
      identification: {
        type: payer.identification.docType,
        number: payer.identification.docNumber
      }
    }
  }).then(async (response) => {
    try {
      const { response: data } = response
      const sessionData = req.session.aplicacaoStep
      const sessionsIDs = req.session.visas.ids

      const newPayment = new Payment({
        transaction_amount: data.transaction_amount,
        transactionId: data.id,
        status: data.status,
        status_details: data.status_detail,
        payment_type_id: data.payment_type_id,
        installments: data.installments,
        visaIDs: sessionsIDs
      })

      const savedPayment = await newPayment.save()

      for (const element of sessionsIDs) {
        const visa = await Visa.findOne({ _id: element })
  
        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
          if(data.status === 'approved') {
            transporter.use('compile', hbs(handlebarOptions))
    
            const mailOptions = {
                from: `eTA Canadense <${process.env.USER_MAIL}>`,
                to: 'contato@etacanadense.com.br',
                subject: 'Pagamento aprovado',
                template: 'pagamento-aprovado',
                context: {
                    codeETA: visa.codeETA,
                }
            }
    
            transporter.sendMail(mailOptions, (err, info) => {
              if(err) {
                  console.error(err)
              } else {
                  console.log(info)
              }
            })
          }
        }
      }

      res.status(200).json({
        id: data.id,
        status: data.status,
        detail: data.status_detail
      })
    }
    catch (e) {
      console.log(e)
      const { errorMessage, errorStatus }  = validateError(e)
      res.status(errorStatus).json({ error_message: errorMessage })
    }
  })
})

router.post("/process-payment-pix", (req, res) => {
  const requestBody = req.body

  const visas = req.session.visas.ids
  const qtyVisas = visas.length

  mercadopago.payment.create({
    payment_method_id: "pix",
    description: 'Solicitação de Autorização de Viagem - Canadá',
    transaction_amount: qtyVisas * 139.65,
    notification_url: "https://etacanadense.com.br/checkout/webhooks?source_news=webhook",
    payer: {
      email: requestBody.payer.email,
      first_name: requestBody.payer.firstName,
      last_name: requestBody.payer.lastName,
      identification: {
        type: requestBody.payer.identification.type,
        number: requestBody.payer.identification.number,
      }
    }
  }).then(async (response) => {
    try {
      const { response: data } = response
      const sessionData = req.session.aplicacaoStep
      const sessionsIDs = req.session.visas.ids

      const newPayment = new Payment({
        transaction_amount: data.transaction_amount,
        transactionId: data.id,
        status: data.status,
        status_details: data.status_detail,
        payment_type_id: data.payment_type_id,
        installments: data.installments,
        qrCode: data.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64,
        visaIDs: sessionsIDs
      })

      const savedPayment = await newPayment.save()

      for (const element of sessionsIDs) {
        const visa = await Visa.findOne({ _id: element })
  
        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
          if(data.status === 'approved') {
            transporter.use('compile', hbs(handlebarOptions))
    
            const mailOptions = {
                from: `eTA Canadense <${process.env.USER_MAIL}>`,
                to: 'contato@etacanadense.com.br',
                subject: 'Pagamento aprovado',
                template: 'pagamento-aprovado',
                context: {
                    codeETA: visa.codeETA,
                }
            }
    
            transporter.sendMail(mailOptions, (err, info) => {
              if(err) {
                  console.error(err)
              } else {
                  console.log(info)
              }
            })
          }
        }
      }

      const qr_code_base = data.point_of_interaction.transaction_data.qr_code_base64
      req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {qr_code_base})
      res.status(200).json({
        id: data.id,
        status: data.status,
        detail: data.status_detail,
        qrCode: data.point_of_interaction.transaction_data.qr_code,
        qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64
      })

    } catch (error){
      console.log(error)
      const { errorMessage, errorStatus }  = validateError(error)
      res.status(errorStatus).json({ error_message: errorMessage })
    }
  })
})

router.post('/webhooks', (req, res, next) => {
  const { body } = req
  const { data: data_webhook } = body

  if(body.action === "payment.updated") {
    fetch(`https://api.mercadopago.com/v1/payments/${data_webhook.id}`, {
      method: "GET",
      headers: {
        'Authorization': `Bearer ${process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN}`
      }
    })
      .then((response) => response.json())
      .then((data) => {
        Visa
          .findOne({idPayment: data_webhook.id})
          .then((visa) => {
            visa.detailPayment = data.status_detail
            visa.statusPayment = data.status

            if(data.status === 'approved') {
              transporter.use('compile', hbs(handlebarOptions))

              transporter.sendMail(
                {
                  from: `eTA Canadense <${process.env.USER_MAIL}>`,
                  to: visa.contactEmail,
                  // bcc: 'contato@etacanadense.com.br',
                  subject: `Confirmação de Recebimento Código ${visa.codeETA} - Autorização Eletrônica de Viagem Canadense`,
                  template: 'aviso-eta',
                },
                (err, info) => {
                  if(err) {
                      console.error(err)
                      
                  } else {
                      console.log(info)
                  }
                })

              transporter.use('compile', hbs(handlebarOptions))

              transporter.sendMail(
                {
                  from: `eTA Canadense <${process.env.USER_MAIL}>`,
                  // to: 'contato@etacanadense.com.br',
                  subject: 'Pagamento aprovado',
                  template: 'pagamento-aprovado',
                  context: {
                    codeETA: visa.codeETA,
                  }
                },
                (err, info) => {
                  if(err) {
                      console.error(err)
                  } else {
                      console.log(info)
                  }
              })
            }
      
            visa.save().then(() => {
              res.status(200).end()
            }).catch((e) => {
              console.error(e)
              res.status(409).end()
            })
          }).catch((e) => {
            console.error(e)
            res.status(409).end()
          })
      }).catch((e) => {
        console.log("Erro:")
        console.error(e)
      })
  }

  res.status(200).send("OK")
})

router.get('/verify-pix-payment', (req, res) => {
  Visa.findOne({idPayment: req.query.transactionID}).then((response) => {
    return res.json(response)
  }).catch(error => {
      console.error(error)
      res.status(500).json({ error: "Erro ao verificar pagamento" })
  })
})

router.get('/pix', (req, res) => {
  const sessionaData = req.session.aplicacaoStep
  if('visaID' in sessionaData) {
    const title = 'PIX - '
    const { id, status, qr_code } = req.query
    const qr_code_base = req.session.aplicacaoStep.qr_code_base
    res.render('checkout/pix', { title, id, status, qr_code, qr_code_base })
  } else {
    req.flash('error_msg', 'Os campos na etapa 4 devem ser preenchidos.')
    res.redirect(`/aplicacao?etapa=4`)
  }
})

router.get('/obrigado', (req, res) => {
  const sessionaData = req.session.aplicacaoStep
  if('visaID' in sessionaData) {
    const { status, status_detail, transaction_id } = req.query
    res.render('checkout/obrigado', { status, status_detail, transaction_id })
  } else {
    req.flash('error_msg', 'Os campos na etapa 4 devem ser preenchidos.')
    res.redirect(`/aplicacao?etapa=4`)
  }
})

router.get('/recusado', (req, res) => {
  const sessionaData = req.session.aplicacaoStep
  if('visaID' in sessionaData) {
    const { status, status_detail, transaction_id } = req.query
    res.render('checkout/recusado', { status, status_detail, transaction_id })
  } else {
    req.flash('error_msg', 'Os campos na etapa 4 devem ser preenchidos.')
    res.redirect(`/aplicacao?etapa=4`)
  }
})

router.get('/em_processo', (req, res) => {
  const sessionaData = req.session.aplicacaoStep
  if('visaID' in sessionaData) {
    const { status, status_detail, transaction_id } = req.query
    res.render('checkout/em_processo', { status, status_detail, transaction_id })
  } else {
    req.flash('error_msg', 'Os campos na etapa 4 devem ser preenchidos.')
    res.redirect(`/aplicacao?etapa=4`)
  }
})

router.get('/error', (req, res) => {
  res.send('Error')
})

function validateError(error) {
  let errorMessage = 'Unknown error cause'
  let errorStatus = 400

  if(error.cause) {
    const sdkErrorMessage = error.cause[0].description
    errorMessage = sdkErrorMessage || errorMessage

    const sdkErrorStatus = error.status
    errorStatus = sdkErrorStatus || errorStatus
  }

  return { errorMessage, errorStatus }
}

module.exports = router