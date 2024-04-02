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


///////////////
// PAGAMENTO //
///////////////
router.get('/', async (req, res) => {
  const sessionData = req.session.aplicacaoStep
  const title = 'Checkout - '

  if('visaID' in sessionData) {
    const publicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY
    const visas = req.session.visas.ids
    const qtyVisas = visas.length

    try {
      const visasData = await Visa.find({_id: { $in: visas }})
      res.render('checkout/index', {title, sessionData, publicKey, visas, visasData, qtyVisas})
    } catch (err) {
      console.log("Erro ao carregar o checkout (index): " + new Date())
      console.log(err)
      req.flash('error_msg', 'Não foi possível carregar o checkout. Se o erro persistir, entre em contato através do e-mail contato@etacanadense.com.br')
      res.redirect('/')
    }

  } else {
    req.flash('error_msg', 'Os campos na etapa 4 devem ser preenchidos.')
    res.redirect(`/aplicacao?etapa=4`)
  }
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
        type: payer.identification.type,
        number: payer.identification.number
      }
    }
  }).then(async (response) => {
    try {
      const { response: data } = response
      const sessionData = req.session.aplicacaoStep
      const sessionsIDs = req.session.visas.ids

      const newPayment = await Payment.findOneAndUpdate(
        { idCheckout: req.session.sessionCheckout },
        {
          $set: {
            transaction_amount: data.transaction_amount,
            transactionId: data.id,
            docType: payer.identification.type,
            docNumber: payer.identification.number,
            status: data.status,
            status_details: data.status_detail,
            payment_type_id: data.payment_type_id,
            installments: data.installments,
            visaIDs: sessionsIDs
          }
        }
      )
      
      const savedPayment = await newPayment.save()

      for (const element of sessionsIDs) {
        const visa = await Visa.findOne({ _id: element })
  
        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
          if(data.status === 'approved') {
            transporter.use('compile', hbs(handlebarOptions))
    
            const mailOptions = {
                from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                to: process.env.CANADENSE_RECEIVER_MAIL,
                subject: 'Pagamento aprovado',
                template: 'pagamento-aprovado',
                context: {
                  nome: visa.firstName,
                  codeETA: visa.codeETA,
                }
            }
    
            transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
              if(err) {
                console.log("Pagamento aprovado (cartão primeira tentativa): " + new Date())
                console.log(err)
              } else {
                console.log({
                  message: `Pagamento aprovado (cartão primeira tentativa): ${new Date()}`,
                  response,
                  envelope,
                  messageId
                })
              }
            })

          } else if (data.status === 'rejected' || data.status === 'cancelled') {
            const visas = savedPayment.visaIDs
            const qtyVisas = visas.length
            
            let linkStripe
            switch (qtyVisas) {
              case 1:
                linkStripe = "https://buy.stripe.com/eVa3gb94k9EF52w002"
                break

              case 2:
                linkStripe = "https://buy.stripe.com/dR69Ez6WccQR66A6or"
                break
              
              case 3:
                linkStripe = "https://buy.stripe.com/eVag2X5S8cQRfHa5ko"
                break

              case 4:
                linkStripe = "https://buy.stripe.com/fZe8Ava8o045fHa5kp"
                break
              
              case 5:
                linkStripe = "https://buy.stripe.com/cN27wr4O4bMNfHa4gm"
                break

              case 6:
                linkStripe = "https://buy.stripe.com/8wM5ojeoEaIJbqU8wD"
                break
                
              default:
                linkStripe = "https://buy.stripe.com/3cs1833K0cQR1QkdQQ"
                break
            }

            transporter.use('compile', hbs(handlebarOptions))

            const mailOptions = {
                from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                to: visa.contactEmail,
                bcc: process.env.CANADENSE_RECEIVER_MAIL,
                subject: 'Pagamento recusado',
                template: 'pagamento-recusado',
                context: {
                  nome: visa.firstName,
                  codeETA: visa.codeETA,
                  transactionid: savedPayment.transactionId,
                  linkStripe
                }
            }
    
            transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
              if(err) {
                console.log("Pagamento recusado (cartão primeira tentativa): " + new Date())
                console.log(err)
              } else {
                  console.log({
                      message: `Pagamento recusado (cartão primeira tentativa): ${new Date()}`,
                      response, envelope, messageId})
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
    transaction_amount: qtyVisas * 139.65,
    payment_method_id: "pix",
    description: 'Solicitação de Autorização de Viagem - Canadá',
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

      const newPayment = await Payment.findOneAndUpdate(
        { idCheckout: req.session.sessionCheckout },
        {
          $set: {
            transaction_amount: data.transaction_amount,
            transactionId: data.id,
            docType: requestBody.payer.identification.type,
            docNumber: requestBody.payer.identification.number,
            status: data.status,
            status_details: data.status_detail,
            payment_type_id: data.payment_type_id,
            qrCode: data.point_of_interaction.transaction_data.qr_code,
            qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64,
            visaIDs: sessionsIDs,
            createdAt: new Date(data.date_created)
          }
        }
      )

      const savedPayment = await newPayment.save()

      for (const element of sessionsIDs) {
        const visa = await Visa.findOne({ _id: element })
  
        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
          if(data.status === 'approved') {
            transporter.use('compile', hbs(handlebarOptions))
    
            const mailOptions = {
                from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                to: process.env.CANADENSE_RECEIVER_MAIL,
                subject: 'Pagamento aprovado',
                template: 'pagamento-aprovado',
                context: {
                  nome: visa.firstName,
                  codeETA: visa.codeETA,
                }
            }
    
            transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
              if(err) {
                console.log("Pagamento aprovado (pix primeira tentativa): " + new Date())
                console.log(err)
              } else {
                console.log({
                  message: `Pagamento aprovado (pix primeira tentativa): ${new Date()}`,
                  response,
                  envelope,
                  messageId
                })
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


//////////////////////
// NOVAS TENTATIVAS //
//////////////////////
router.get('/retry/:id', async (req, res) => {
  const title = 'Checkout - '
  const publicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY
  const payment = await Payment.findOne({transactionId: req.params.id}).populate('visaIDs')
  
  if (!payment) {
    req.flash('error_msg', 'Esse pagamento não existe ou já foi concluído')
    res.redirect('/')
  } else {
    const qtyVisas = payment.visaIDs.length
    res.render('checkout/retry', {payment, title, publicKey, qtyVisas, transactionid: req.params.id})
  }
})

router.get('/retry-email', async (req, res) => {
  try {
    const title = 'Checkout - '
    const publicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY
    const payment = await Payment.findOne({transactionId: req.query.transactionid}).populate('visaIDs')
    const qtyVisas = payment.visaIDs.length

    res.render('checkout/retry-email', {payment, title, publicKey, qtyVisas, transactionid: req.query.transactionid})
  } catch {
    req.flash('error_msg', 'Esse pagamento não existe ou já foi concluído')
    res.redirect('/')
  }
  

})

router.post('/process-payment-retry', async (req, res) => {
  const { body } = req
  const { payer } = body

  const payment = await Payment.findOne({transactionId: req.query.transactionid}).populate('visaIDs')
  const visas = payment.visaIDs
  const qtyVisas = visas.length

  const updatedPayment = await mercadopago.payment.create({
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
        type: payer.identification.type,
        number: payer.identification.number
      }
    }
  })
  
  payment.transaction_amount = updatedPayment.response.transaction_amount
  payment.transactionId = updatedPayment.response.id
  payment.docType = payer.identification.type
  payment.docNumber = payer.identification.number
  payment.status = updatedPayment.response.status
  payment.status_details = updatedPayment.response.status_detail
  payment.payment_type_id = updatedPayment.response.payment_type_id
  payment.installments = updatedPayment.response.installments
  payment.createdAt = new Date(updatedPayment.response.date_created)

  const savedPayment = await payment.save()

  for (const visa of visas) {
    Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } });

    if (visa) {
      await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
      if(savedPayment.status === 'approved') {
        transporter.use('compile', hbs(handlebarOptions))

        const mailOptions = {
          from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
          to: process.env.CANADENSE_RECEIVER_MAIL,
          subject: 'Pagamento aprovado',
          template: 'pagamento-aprovado',
          context: {
            nome: visa.firstName,
            codeETA: visa.codeETA,
          }
        }

        transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
          if(err) {
            console.log("Pagamento aprovado (cartão outras tentativas): " + new Date())
            console.log(err)
          } else {
            console.log({
              message: `Pagamento aprovado (cartão outras tentativas): ${new Date()}`,
              response,
              envelope,
              messageId
            })
          }
        })
      } else if (savedPayment.status === 'rejected' || savedPayment.status === 'cancelled') {
        const visas = savedPayment.visaIDs
        const qtyVisas = visas.length
        
        let linkStripe
        switch (qtyVisas) {
          case 1:
            linkStripe = "https://buy.stripe.com/eVa3gb94k9EF52w002"
            break

          case 2:
            linkStripe = "https://buy.stripe.com/dR69Ez6WccQR66A6or"
            break
          
          case 3:
            linkStripe = "https://buy.stripe.com/eVag2X5S8cQRfHa5ko"
            break

          case 4:
            linkStripe = "https://buy.stripe.com/fZe8Ava8o045fHa5kp"
            break
          
          case 5:
            linkStripe = "https://buy.stripe.com/cN27wr4O4bMNfHa4gm"
            break

          case 6:
            linkStripe = "https://buy.stripe.com/8wM5ojeoEaIJbqU8wD"
            break
            
          default:
            linkStripe = "https://buy.stripe.com/3cs1833K0cQR1QkdQQ"
            break
        }
        
        transporter.use('compile', hbs(handlebarOptions))

        const mailOptions = {
            from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
            to: visa.contactEmail,
            bcc: process.env.CANADENSE_RECEIVER_MAIL,
            subject: 'Pagamento recusado',
            template: 'pagamento-recusado',
            context: {
              nome: visa.firstName,
              codeETA: visa.codeETA,
              transactionid: savedPayment.transactionId,
              linkStripe
            }
        }

        transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
          if(err) {
            console.log("Pagamento recusado (cartão outras tentativas): " + new Date())
            console.log(err)
          } else {
            console.log({
              message: `Pagamento recusado (cartão outras tentativas): ${new Date()}`,
              response,
              envelope,
              messageId
            })
          }
        })
      }
    }
  }

  res.status(200).json({
    id: updatedPayment.response.id,
    status: updatedPayment.response.status,
    detail: updatedPayment.response.status_detail
  })
})

router.post('/process-payment-pix-retry', async (req, res) => {
  const requestBody = req.body

  const payment = await Payment.findOne({transactionId: req.query.transactionid}).populate('visaIDs')
  const visas = payment.visaIDs
  const qtyVisas = visas.length

  mercadopago.payment.create({
    transaction_amount: qtyVisas * 139.65,
    payment_method_id: "pix",
    description: 'Solicitação de Autorização de Viagem - Canadá',
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
      payment.transaction_amount = data.transaction_amount,
      payment.transactionId = data.id,
      payment.docType = requestBody.payer.identification.type,
      payment.docNumber = requestBody.payer.identification.number,
      payment.status = data.status,
      payment.status_details = data.status_detail,
      payment.payment_type_id = data.payment_type_id,
      payment.installments = data.installments,
      payment.qrCode = data.point_of_interaction.transaction_data.qr_code,
      payment.qrCodeBase64 = data.point_of_interaction.transaction_data.qr_code_base64,
      payment.visaIDs = visas,
      payment.createdAt = new Date(data.date_created)
  
      const savedPayment = await payment.save()

      for (const element of visas) {
        const visa = await Visa.findOne({ _id: element })
  
        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
          if(data.status === 'approved') {
            transporter.use('compile', hbs(handlebarOptions))
    
            const mailOptions = {
                from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                to: process.env.CANADENSE_RECEIVER_MAIL,
                subject: 'Pagamento aprovado',
                template: 'pagamento-aprovado',
                context: {
                  nome: visa.firstName,
                  codeETA: visa.codeETA,
                }
            }
    
            transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
              if(err) {
                console.log("Pagamento aprovado (pix outras tentativas): " + new Date())
                console.log(err)
              } else {
                console.log({
                  message: `Pagamento aprovado (pix outras tentativas): ${new Date()}`,
                  response,
                  envelope,
                  messageId
                })
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

router.get('/abandoned', async (req, res) => {
  try {
    const title = 'Checkout - '
    const publicKey = process.env.MERCADO_PAGO_SAMPLE_PUBLIC_KEY
    const payment = await Payment.findOne({idCheckout: req.query.idcheckout}).populate('visaIDs')
    const qtyVisas = payment.visaIDs.length

    res.render('checkout/abandoned', {payment, title, publicKey, qtyVisas, idcheckout: req.query.idcheckout})
  } catch {
    req.flash('error_msg', 'Esse pagamento não existe ou já foi concluído')
    res.redirect('/')
  }
})

router.post('/process-payment-abandoned', async (req, res) => {
  const { body } = req
  const { payer } = body

  const payment = await Payment.findOne({idCheckout: req.query.idcheckout}).populate('visaIDs')
  const visas = payment.visaIDs
  const qtyVisas = visas.length

  const updatedPayment = await mercadopago.payment.create({
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
        type: payer.identification.type,
        number: payer.identification.number
      }
    }
  })
  
  payment.transaction_amount = updatedPayment.response.transaction_amount
  payment.transactionId = updatedPayment.response.id
  payment.docType = payer.identification.type
  payment.docNumber = payer.identification.number
  payment.status = updatedPayment.response.status
  payment.status_details = updatedPayment.response.status_detail
  payment.payment_type_id = updatedPayment.response.payment_type_id
  payment.installments = updatedPayment.response.installments
  payment.createdAt = new Date(updatedPayment.response.date_created)

  const savedPayment = await payment.save()

  for (const visa of visas) {
    Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } });

    if (visa) {
      await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
      if(savedPayment.status === 'approved') {
        transporter.use('compile', hbs(handlebarOptions))

        const mailOptions = {
            from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
            // to: process.env.CANADENSE_RECEIVER_MAIL,
            subject: 'Pagamento aprovado',
            template: 'pagamento-aprovado',
            context: {
              nome: visa.firstName,
              codeETA: visa.codeETA,
            }
        }

        transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
          if(err) {
            console.log("Pagamento aprovado (cartão checkout abandonado): " + new Date())
            console.log(err)
          } else {
            console.log({
              message: `Pagamento aprovado (cartão checkout abandonado): ${new Date()}`,
              response,
              envelope,
              messageId
            })
          }
        })
      } else if (savedPayment.status === 'rejected' || savedPayment.status === 'cancelled') {
        const visas = savedPayment.visaIDs
        const qtyVisas = visas.length
        let linkStripe

        switch (qtyVisas) {
          case 1:
            linkStripe = "https://buy.stripe.com/eVa3gb94k9EF52w002"
            break

          case 2:
            linkStripe = "https://buy.stripe.com/dR69Ez6WccQR66A6or"
            break
          
          case 3:
            linkStripe = "https://buy.stripe.com/eVag2X5S8cQRfHa5ko"
            break

          case 4:
            linkStripe = "https://buy.stripe.com/fZe8Ava8o045fHa5kp"
            break
          
          case 5:
            linkStripe = "https://buy.stripe.com/cN27wr4O4bMNfHa4gm"
            break

          case 6:
            linkStripe = "https://buy.stripe.com/8wM5ojeoEaIJbqU8wD"
            break
            
          default:
            linkStripe = "https://buy.stripe.com/3cs1833K0cQR1QkdQQ"
            break
        }
        
        transporter.use('compile', hbs(handlebarOptions))

        const mailOptions = {
            from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
            to: visa.contactEmail,
            bcc: process.env.CANADENSE_RECEIVER_MAIL,
            subject: 'Pagamento recusado',
            template: 'pagamento-recusado',
            context: {
              nome: visa.firstName,
              codeETA: visa.codeETA,
              transactionid: savedPayment.transactionId,
              linkStripe
            }
        }

        transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
          if(err) {
            console.log("Pagamento recusado (cartão abandonado): " + new Date())
            console.log(err)
          } else {
            console.log({
              message: `Pagamento recusado (cartão abandonado): ${new Date()}`,
              response,
              envelope,
              messageId
            })
          }
        })
      }
    }
  }

  res.status(200).json({
    id: updatedPayment.response.id,
    status: updatedPayment.response.status,
    detail: updatedPayment.response.status_detail
  })
})

router.post('/process-payment-pix-abandoned', async (req, res) => {
  const requestBody = req.body

  const payment = await Payment.findOne({idCheckout: req.query.idcheckout}).populate('visaIDs')
  const visas = payment.visaIDs
  const qtyVisas = visas.length

  mercadopago.payment.create({
    transaction_amount: qtyVisas * 139.65,
    payment_method_id: "pix",
    description: 'Solicitação de Autorização de Viagem - Canadá',
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
      payment.transaction_amount = data.transaction_amount,
      payment.transactionId = data.id,
      payment.docType = requestBody.payer.identification.type,
      payment.docNumber = requestBody.payer.identification.number,
      payment.status = data.status,
      payment.status_details = data.status_detail,
      payment.payment_type_id = data.payment_type_id,
      payment.installments = data.installments,
      payment.qrCode = data.point_of_interaction.transaction_data.qr_code,
      payment.qrCodeBase64 = data.point_of_interaction.transaction_data.qr_code_base64,
      payment.visaIDs = visas,
      payment.createdAt = new Date(data.date_created)

      const savedPayment = await payment.save()

      for (const element of visas) {
        const visa = await Visa.findOne({ _id: element })
  
        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
          if(data.status === 'approved') {
            transporter.use('compile', hbs(handlebarOptions))
    
            const mailOptions = {
                from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                to: process.env.CANADENSE_RECEIVER_MAIL,
                subject: 'Pagamento aprovado',
                template: 'pagamento-aprovado',
                context: {
                  nome: visa.firstName,
                  codeETA: visa.codeETA,
                }
            }
    
            transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
              if(err) {
                console.log("Pagamento aprovado (pix abandonado): " + new Date())
                console.log(err)
              } else {
                console.log({
                  message: `Pagamento aprovado (pix abandonado): ${new Date()}`,
                  response,
                  envelope,
                  messageId
                })
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


////////////////
// AUXILIARES //
////////////////
router.get('/verify-pix-payment', (req, res) => {
  Payment.findOne({transactionId: req.query.transactionID}).then((response) => {
    return res.json(response)
  }).catch(error => {
      console.error(error)
      res.status(500).json({ error: "Erro ao verificar pagamento" })
  })
})

router.get('/pix', (req, res) => {
  const title = 'PIX - '
  const { id, status, qr_code } = req.query
  const qr_code_base = req.session.aplicacaoStep.qr_code_base
  
  res.render('checkout/pix', { title, id, status, qr_code, qr_code_base })
})

router.get('/obrigado', (req, res) => {
    const { status, status_detail, transaction_id } = req.query

    res.render('checkout/obrigado', { status, status_detail, transaction_id })
})

router.get('/recusado', (req, res) => {
  const { status, status_detail, transaction_id } = req.query

  res.render('checkout/recusado', { status, status_detail, transaction_id })
})

router.get('/recusado_retry', (req, res) => {
  const { status, status_detail, transaction_id } = req.query

  res.render('checkout/recusado_retry', { status, status_detail, transaction_id })
})

router.get('/em_processo', (req, res) => {
    const { status, status_detail, transaction_id } = req.query

    res.render('checkout/em_processo', { status, status_detail, transaction_id })
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


//////////////
// WEBHOOKS //
//////////////
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
        Payment.findOne({transactionId: data_webhook.id})
          .then(async (payment) => {
            payment.status_details = data.status_detail
            payment.status = data.status

            for (const element of payment.visaIDs) {
              const visa = await Visa.findOne({ _id: element })
        
              if (visa) {
                if(data.status === 'approved') {
                  transporter.use('compile', hbs(handlebarOptions))
    
                  transporter.sendMail(
                    {
                      from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                      to: visa.contactEmail,
                      bcc: process.env.CANADENSE_RECEIVER_MAIL,
                      subject: `Confirmação de Recebimento Código ${visa.codeETA} - Autorização Eletrônica de Viagem Canadense`,
                      template: 'aviso-eta',
                    },
                    (err, {response, envelope, messageId}) => {
                      if(err) {
                        console.log("Confirmação de recebimento (Webhook): " + new Date())
                        console.log(err)
                      } else {
                          console.log({
                              message: `Confirmação de recebimento (Webhook): ${new Date()}`,
                              response, envelope, messageId})
                      }
                    })
    
                  transporter.use('compile', hbs(handlebarOptions))
    
                  transporter.sendMail(
                    {
                      from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                      to: process.env.CANADENSE_RECEIVER_MAIL,
                      subject: 'Pagamento aprovado',
                      template: 'pagamento-aprovado',
                      context: {
                        nome: visa.firstName,
                        codeETA: visa.codeETA,
                      }
                    },
                    (err, {response, envelope, messageId}) => {
                      if(err) {
                        console.log("Pagamento aprovado (Webhook): " + new Date())
                        console.log(err)
                      } else {
                          console.log({
                              message: `Pagamento aprovado (Webhook): ${new Date()}`,
                              response, envelope, messageId})
                      }
                  })
                } else if (data.status === 'rejected' || data.status === 'cancelled') {
                  const visas = payment.visaIDs
                  const qtyVisas = visas.length
                  let linkStripe

                  switch (qtyVisas) {
                    case 1:
                      linkStripe = "https://buy.stripe.com/eVa3gb94k9EF52w002"
                      break

                    case 2:
                      linkStripe = "https://buy.stripe.com/dR69Ez6WccQR66A6or"
                      break
                    
                    case 3:
                      linkStripe = "https://buy.stripe.com/eVag2X5S8cQRfHa5ko"
                      break

                    case 4:
                      linkStripe = "https://buy.stripe.com/fZe8Ava8o045fHa5kp"
                      break
                    
                    case 5:
                      linkStripe = "https://buy.stripe.com/cN27wr4O4bMNfHa4gm"
                      break

                    case 6:
                      linkStripe = "https://buy.stripe.com/8wM5ojeoEaIJbqU8wD"
                      break
                      
                    default:
                      linkStripe = "https://buy.stripe.com/3cs1833K0cQR1QkdQQ"
                      break
                  }
                  
                  transporter.use('compile', hbs(handlebarOptions))
          
                  const mailOptions = {
                    from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
                    to: visa.contactEmail,
                    bcc: process.env.CANADENSE_RECEIVER_MAIL,
                    subject: 'Pagamento recusado',
                    template: 'pagamento-recusado',
                    context: {
                      nome: visa.firstName,
                      codeETA: visa.codeETA,
                      transactionid: payment.transactionId,
                      linkStripe
                    }
                  }
          
                  transporter.sendMail(mailOptions, (err, info) => {
                    if(err) {
                      console.log("Pagamento recusado (Webhook): " + new Date())
                      console.log(err)
                    } else {
                        console.log({
                            message: `Pagamento recusado (Webhook): ${new Date()}`,
                            response, envelope, messageId})
                    }
                  })
                }
              }
            }
      
            payment.save().then(() => {
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

module.exports = router