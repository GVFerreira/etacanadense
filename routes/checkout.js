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
  const title = 'Checkout - '
  const data = req.session.aplicacaoStep
  res.render('checkout/index', {title, mercadoPagoAccessToken, data})
})

router.post('/process-payment', (req, res) => {
  const { body } = req
  const { payer } = body
  const paymentData = {
    transaction_amount: 99.00,
    token: body.token,
    description: 'Solicitação de Autorização de Viagem - Canadá',
    installments: Number(body.installments),
    payment_method_id: body.paymentMethodId,
    issuer_id: body.issuerId,
    payer: {
      email: payer.email,
      identification: {
        type: payer.identification.docType,
        number: payer.identification.docNumber
      }
    }
  }

  mercadopago.payment.create(paymentData).then(response => {
    const { status, status_detail, id } = response.body
    console.log(status, status_detail, id)

    if (status === 'approved') {
      console.log('boa1')
      res.redirect(`/checkout/result-payment?status=${status}&detail=${status_detail}&id=${id}`)
    } else if (status === 'in_process' || status === 'rejected') {
      console.log('boa2')
      res.redirect(`/checkout/result-payment?status=${status}&detail=${status_detail}&id=${id}`)
    } else {
      // Lide com outros status conforme necessário
      res.redirect('/checkout/error')
    }
  }).catch(error => {
    console.error(error)
    res.redirect('/checkout/error')
  })
})

router.post('/process-payment-pix', (req, res) => {
  const requestBody = req.body
  const paymentData = {
    payment_method_id: "pix",
    description: requestBody.description,
    transaction_amount: Number(requestBody.transactionAmount),
    payer: {
      email: requestBody.payer.email,
      first_name: requestBody.payer.firstName,
      last_name: requestBody.payer.lastName,
      identification: {
        type: requestBody.payer.identification.type,
        number: requestBody.payer.identification.number,
      }
    }
  }
  
  mercadopago.payment.create(paymentData).then((data) => {
    const { response } = data

    res.status(201).json({
      id: response.id,
      status: response.status,
      detail: response.status_detail,
      qrCode: response.point_of_interaction.transaction_data.qr_code,
      qrCodeBase64: response.point_of_interaction.transaction_data.qr_code_base64,
    })
  }).catch( (error) => {
    console.log(error)
    const { errorMessage, errorStatus }  = validateError(error)
    res.status(errorStatus).json({ error_message: errorMessage })
  })
})

router.get('/result-payment', (req, res) => {
  const { status, detail, id } = req.query
  res.render('checkout/result-payment', { status, detail, id })
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
