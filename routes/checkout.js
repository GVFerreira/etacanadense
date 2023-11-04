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
  const publicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY
  res.render('checkout/index', {title, mercadoPagoAccessToken, data, publicKey})
})

router.post('/process-payment', (req, res) => {
  const { body } = req
  const { payer } = body

  mercadopago.payment
  .create({
    transaction_amount: 0.01, //testes
    // transaction_amount: 147.00, //produção
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
            res.status(409).json({
              detail: data.status_detail,
              status: data.status,
              id: data.id
            })
          })
      })
      .catch((e) => {
        console.log(e)
        res.status(409).json({
          detail: data.detail,
          status: data.status,
          id: data.id
        })
      })

  })
  .catch(error => {
    console.log(error)
    const { errorMessage, errorStatus }  = validateError(error)
    res.status(errorStatus).json({ error_message: errorMessage })

  })
})

router.post("/process-payment-pix", (req, res) => {
  const requestBody = req.body
  const data = {
    payment_method_id: "pix",
    description: 'Solicitação de Autorização de Viagem - Canadá',
    transaction_amount: 0.01, //testes
    // transaction_amount: 147.00, //produção
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

    res.status(201).json({
      id: response.id,
      status: response.status,
      detail: response.status_detail,
      qrCode: response.point_of_interaction.transaction_data.qr_code,
      qrCodeBase64: response.point_of_interaction.transaction_data.qr_code_base64,
    })

  }).catch((error) => {
    console.log(error)
    const { errorMessage, errorStatus }  = validateError(error)
    res.status(errorStatus).json({ error_message: errorMessage })
  })
})

router.post('/webhooks', (req, res) => {
  const { body } = req
  const { data: payment_data } = body

  console.log(body)
  console.log(payment_data)

  if(body.action === "payment.updated") {
    Visa
    .findOne({
      idPayment: payment_data.id
    })
    .then((visa) => {
      visa.detailPayment = payment_data.detail
      visa.statusPayment = payment_data.status

      visa
        .save()
        .then(() => {
          res.status(200).end()
        })
        .catch((e) => {
          console.error(e)
          res.status(409).end()
        })
    })
    .catch((e) => {
      console.error(e)
      res.status(409).end()
    })
  }
  
  res.status(200).send("OK")
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
