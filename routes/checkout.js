const express = require('express')
const router = express.Router()
const mongoose = require('mongoose')
require('../models/Visa')
const Visa = mongoose.model("visa")
const mercadopago = require('mercadopago')
const dotenv = require('dotenv')
dotenv.config()
const bodyParser = require('body-parser')
router.use(bodyParser.urlencoded({extended: true}))
router.use(bodyParser.json())

const nodemailer = require('nodemailer')
const { transporter, handlebarOptions } = require('../helpers/senderMail')
const hbs = require('nodemailer-express-handlebars')

const mercadoPagoPublicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY;
if (!mercadoPagoPublicKey) {
  console.log("Error: public key not defined");
  process.exit(1);
}

const mercadoPagoAccessToken = process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN;
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
    res.render('checkout/index', {title, mercadoPagoAccessToken, data, publicKey})
  } else {
    req.flash('error_msg', 'Os campos na etapa 4 devem ser preenchidos.')
    res.redirect(`/aplicacao?etapa=4`)
  }
})

router.post('/process-payment', (req, res) => {
  const { body } = req
  const { payer } = body

  mercadopago.payment
  .create({
    // transaction_amount: 0.01, //testes
    transaction_amount: 147.00, //produção
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
  })
  .then(response => {
    const { response: data } = response
    const sessionData = req.session.aplicacaoStep

    Visa
      .findOne({
        _id: sessionData.visaID
      })
      .then((visa) => {
        visa.detailPayment = data.status_detail
        visa.statusPayment = data.status
        visa.idPayment = data.id

        if(data.status === 'approved') {

          transporter.use('compile', hbs(handlebarOptions))

          const mailOptions = {
              from: `eTA Canadense <${process.env.USER_MAIL}>`,
              to: 'contato@etacanadense.com.br',
              subject: 'Pagmento aprovado',
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

        visa
          .save()
          .then(() => {
            res.status(200).json({
              detail: data.status_detail,
              status: data.status,
              id: data.id
            })
          })
          .catch((e) => {
            console.log(e)
            req.flash('error_msg', 'Falha ao processar o pagamento, tente novamente. Se o erro persistir entre em contato com o suporte.')
            res.redirect('/checkout')
          })
      })
      .catch((e) => {
        console.log(e)
        req.flash('error_msg', 'Falha ao processar o pagamento, tente novamente. Se o erro persistir entre em contato com o suporte.')
        res.redirect('/checkout')
      })

  })
  .catch((e) => {
    console.log(e)
    const { errorMessage, errorStatus }  = validateError(e)
    res.status(errorStatus).json({ error_message: errorMessage })
  })
})

router.post("/process-payment-pix", (req, res) => {
  const requestBody = req.body
  const data = {
    payment_method_id: "pix",
    description: 'Solicitação de Autorização de Viagem - Canadá',
    // transaction_amount: 0.01, //testes
    transaction_amount: 139.65, //produção
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
  };

  mercadopago.payment.create(data).then((data) => {
    const { response } = data
    const sessionData = req.session.aplicacaoStep

    Visa
      .findOne({
        _id: sessionData.visaID
      })
      .then((visa) => {
        visa.detailPayment = response.status_detail
        visa.statusPayment = response.status
        visa.idPayment = response.id

        if(response.status === 'approved') {

          transporter.use('compile', hbs(handlebarOptions))

          const mailOptions = {
              from: `eTA Canadense <${process.env.USER_MAIL}>`,
              to: 'contato@etacanadense.com.br',
              subject: 'Pagmento aprovado',
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

        visa
          .save()
          .then(() => {
            const qr_code_base = response.point_of_interaction.transaction_data.qr_code_base64
            req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {qr_code_base})
            res.status(200).json({
              id: response.id,
              status: response.status,
              detail: response.status_detail,
              qrCode: response.point_of_interaction.transaction_data.qr_code,
              qrCodeBase64: response.point_of_interaction.transaction_data.qr_code_base64
            })
          })
          .catch((e) => {
            console.log(e)
            const qr_code_base = response.point_of_interaction.transaction_data.qr_code_base64
            req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {qr_code_base})
            res.status(409).json({
              id: response.id,
              status: response.status,
              detail: response.status_detail,
              qrCode: response.point_of_interaction.transaction_data.qr_code,
              qrCodeBase64: response.point_of_interaction.transaction_data.qr_code_base64
            })
          })
      })
      .catch((e) => {
        console.log(e)
        const qr_code_base = response.point_of_interaction.transaction_data.qr_code_base64
        req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {qr_code_base})
        res.status(409).json({
          id: response.id,
          status: response.status,
          detail: response.status_detail,
          qrCode: response.point_of_interaction.transaction_data.qr_code,
          qrCodeBase64: response.point_of_interaction.transaction_data.qr_code_base64
        })
      })

  }).catch((error) => {
    console.log(error)
    const { errorMessage, errorStatus }  = validateError(error)
    res.status(errorStatus).json({ error_message: errorMessage })
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
        .findOne({
          idPayment: data_webhook.id
        })
        .then((visa) => {
          visa.detailPayment = data.status_detail
          visa.statusPayment = data.status
          console.log(data.status)
          if(data.status === 'approved') {

            transporter.use('compile', hbs(handlebarOptions))

            const mailOptions = {
                from: `eTA Canadense <${process.env.USER_MAIL}>`,
                to: 'contato@etacanadense.com.br',
                subject: 'Pagmento aprovado',
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
  fetch(`https://api.mercadopago.com/v1/payments/${req.params.transactionID}`, {
    method: "GET",
    headers: {
      'Authorization': `Bearer ${process.env.MERCADO_PAGO_SAMPLE_ACCESS_TOKEN}`
    }
  }).then((response) => {
    return response.json()
  }).then((result) => {
    res.json(result)
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
