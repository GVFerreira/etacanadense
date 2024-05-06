const express = require('express')
const router = express.Router()

const mongoose = require('mongoose')
require('../models/Visa')
const Visa = mongoose.model("visa")
require('../models/Payment')
const Payment = mongoose.model("payment")

const dotenv = require('dotenv')
dotenv.config()

const bodyParser = require('body-parser')
router.use(bodyParser.urlencoded({extended: true}))
router.use(bodyParser.json())

const nodemailer = require('nodemailer')
const { transporter, handlebarOptions } = require('../helpers/senderMail')
const hbs = require('nodemailer-express-handlebars')

///////////////
// PAGAMENTO //
///////////////
router.get('/', async (req, res) => {
  const sessionData = req.session.aplicacaoStep
  const title = 'Checkout - '

  if('visaID' in sessionData) {
    const visas = req.session.visas.ids
    const qtyVisas = visas.length
    try {
      const visasData = await Visa.find({_id: { $in: visas }})

      const reqInstallments = await fetch(`${process.env.BASE_URL}/payment/installments`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            "access-token": process.env.APPMAX_ACCESS_TOKEN,
            "installments": 12,
            "total": qtyVisas * 1,
            "format": 2 
        })
      })
      const { data:installments } = await reqInstallments.json()

      res.render('checkout/index', {title, sessionData, visas, visasData, qtyVisas, installments})

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

router.post('/process-payment', async (req, res) => {
  const {
    cardholderName,
    identificationType,
    identificationNumber,
    cardNumber,
    expirationMonth,
    expirationYear,
    securityCode,
    installmentsInput
  } = req.body

  const visas = req.session.visas.ids
  const qtyVisas = visas.length

  function separateInstallmentsAndValues (inputForm) {
    /// String original
    let stringOriginal = inputForm

    // Encontrando o índice do 'R$'
    let indiceR$ = stringOriginal.indexOf('R$')

    // Extraindo os 2 primeiros caracteres
    let installments = stringOriginal.substr(0, 2)

    // Extraindo os caracteres a partir do índice do 'R$' até o final
    let valueInstallment = stringOriginal.substr(indiceR$ + 3)

    // Convertendo o valor da parcela para float (substituindo ',' por '.' antes de converter)
    let valueInstallmentFloat = parseFloat(valueInstallment.replace('.', '').replace(',', '.'))

    return { installment: parseInt(installments), valueInstallmentFloat }
  }

  function pricePerVisa () {
    const { installment, valueInstallmentFloat } = separateInstallmentsAndValues(installmentsInput)
    const total = installment * valueInstallmentFloat
    return total / qtyVisas
  }

  try {
    const payment = await Payment.findOne({idCheckout: req.session.sessionCheckout})

    const newOrder = await fetch(`${process.env.BASE_URL}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "access-token": process.env.APPMAX_ACCESS_TOKEN,
        "products": [
          {
            "sku": "835102",
            "name": "Assessoria - eTA Canadense",
            "qty": qtyVisas,
            // "price": pricePerVisa(),
            "price": 1,
            "digital_product": 1
          },
        ],
        "customer_id": payment.idClient
      })
    })
    const order = await newOrder.json()

    const createPayment = await fetch(`${process.env.BASE_URL}/payment/credit-card`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "access-token": process.env.APPMAX_ACCESS_TOKEN,
        "cart": { "order_id": order.data.id },
        "customer": { "customer_id": order.data.customer_id },
        "payment": {
          "CreditCard": {
            "number": cardNumber,
            "cvv": securityCode,
            "month": parseInt(expirationMonth),
            "year": parseInt(expirationYear),
            "document_number": identificationNumber,
            "name": cardholderName,
            "installments": separateInstallmentsAndValues(installmentsInput).installment,
            "soft_descriptor": "ETAHUB"
          }
        }
      })
    })
    const cardPayment = await createPayment.json()

    if (cardPayment.success) {
      const newPayment = await Payment.findOneAndUpdate(
        { idCheckout: req.session.sessionCheckout },
        {
          $set: {
            idOrder: order.data.id,
            transaction_amount: order.data.total,
            transactionId: cardPayment.data.pay_reference,
            docType: identificationType,
            docNumber: identificationNumber,
            status: 'approved',
            status_details: 'accredited',
            payment_type_id: 'credit_card',
            installments: separateInstallmentsAndValues(installmentsInput).installment,
            visaIDs: visas
          }
        }
      )
      const savedPayment = await newPayment.save()

      for (const element of visas) {
        const visa = await Visa.findOne({ _id: element })

        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
          
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

          res.redirect(`/checkout/obrigado?status_detail=accredited&status=approved&transaction_id=${order.data.id}`)
          
        }
      }

    } else {
      const newPayment = await Payment.findOneAndUpdate(
        { idCheckout: req.session.sessionCheckout },
        {
          $set: {
            idOrder: order.data.id,
            transaction_amount: order.data.total,
            transactionId: null,
            docType: identificationType,
            docNumber: identificationNumber,
            status: 'rejected',
            status_details: 'cc_rejected_other_reason',
            payment_type_id: 'credit_card',
            installments: separateInstallmentsAndValues(installmentsInput).installment,
            visaIDs: visas
          }
        }
      )
      const savedPayment = await newPayment.save()
      
      // Script de e-mail recusado
      let linkStripe
      const links = {
          1: "https://buy.stripe.com/eVa3gb94k9EF52w002",
          2: "https://buy.stripe.com/dR69Ez6WccQR66A6or",
          3: "https://buy.stripe.com/eVag2X5S8cQRfHa5ko",
          4: "https://buy.stripe.com/fZe8Ava8o045fHa5kp",
          5: "https://buy.stripe.com/cN27wr4O4bMNfHa4gm",
          6: "https://buy.stripe.com/8wM5ojeoEaIJbqU8wD",
      }
      linkStripe = links[qtyVisas] || "https://buy.stripe.com/3cs1833K0cQR1QkdQQ"

      for (const element of visas) {
        const visa = await Visa.findOne({ _id: element })

        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })

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
              transactionid: payment.idOrder,
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
                response, envelope, messageId
              })
            }
          })
        }
      }

      res.redirect(`/checkout/recusado?status_detail='cc_rejected_other_reason'&status=rejected&transaction_id=${order.data.id}`)

    }
  } catch (err) {
    console.log(err)
    res.json(err)
  }
})

router.post("/process-payment-pix", async (req, res) => {
  const {
    identificationType,
    identificationNumber
  } = req.body

  const visas = req.session.visas.ids
  const qtyVisas = visas.length

  try {
    const payment = await Payment.findOne({idCheckout: req.session.sessionCheckout})

    const newOrder = await fetch(`${process.env.BASE_URL}/order`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "access-token": process.env.APPMAX_ACCESS_TOKEN,
        "products": [
          {
            "sku": "835102",
            "name": "Assessoria - eTA Canadense",
            "qty": qtyVisas,
            // "price": 139.65,
            "price": 1,
            "digital_product": 1
          },
        ],
        "customer_id": payment.idClient
      })
    })
    const order = await newOrder.json()

    function expirateDate() {
      let currentDate = new Date()
      currentDate.setHours(currentDate.getHours() + 12)
      let expirationDate = currentDate.toISOString().slice(0, 19).replace('T', ' ')
      return expirationDate
    }

    const createPayment = await fetch(`${process.env.BASE_URL}/payment/pix`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        "access-token": process.env.APPMAX_ACCESS_TOKEN,
        "cart": { "order_id": order.data.id },
        "customer": { "customer_id": order.data.customer_id },
        "payment": {
          "pix": {
            "document_number": identificationNumber,
            "expiration_date": expirateDate()
          }
        }
      })
    })
    const pixPayment = await createPayment.json()

    if (pixPayment.success) {
      const newPayment = await Payment.findOneAndUpdate(
        { idCheckout: req.session.sessionCheckout },
        {
          $set: {
            idOrder: order.data.id,
            transaction_amount: order.data.total,
            transactionId: pixPayment.data.pay_reference,
            docType: identificationType,
            docNumber: identificationNumber,
            status: 'pending',
            status_details: 'waiting_transfer',
            payment_type_id: 'bank_transfer',
            installments: null,
            qrCode: pixPayment.data.pix_emv,
            qrCodeBase64: pixPayment.data.pix_qrcode,
            visaIDs: visas
          }
        }
      )
      
      await newPayment.save()

      const qr_code_base = pixPayment.data.pix_qrcode
      req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {qr_code_base})
      res.status(201).redirect(`/checkout/pix?id=${order.data.id}&status=pending&qr_code=${pixPayment.data.pix_emv}`)

    } else {
      console.log("Erro ao gerar PIX (primeiro checkout): " + new Date())
      console.log(err)

      req.flash('error_msg', "Ocorreu um erro ao gerar seu PIX QR Code")
      res.redirect('/checkout')
    }
  } catch (err) {
    console.log("Erro ao criar o pagamento via PIX (primeiro checkout): " + new Date())
    console.log(err)
    res.redirect('/checkout')
  }
})


//////////////////////
// NOVAS TENTATIVAS //
//////////////////////
// router.get('/retry/:id', async (req, res) => {
//   const title = 'Checkout - '
//   const payment = await Payment.findOne({idOrder: req.params.id}).populate('visaIDs')
  
//   if (!payment) {
//     req.flash('error_msg', 'Esse pagamento não existe ou já foi concluído')
//     res.redirect('/')
//   } else {
//     const reqInstallments = await fetch(`${process.env.BASE_URL}/payment/installments`, {
//       method: "POST",
//       headers: { "Content-Type": "application/json" },
//       body: JSON.stringify({
//           "access-token": process.env.APPMAX_ACCESS_TOKEN,
//           "installments": 12,
//           "total": qtyVisas * 147,
//           "format": 2 
//       })
//     })
//     const { data:installments } = await reqInstallments.json()

//     const qtyVisas = payment.visaIDs.length
//     res.render('checkout/retry', {payment, title, qtyVisas, installments, transactionid: req.params.id})
//   }
// })

// router.get('/retry-email', async (req, res) => {
//   try {
//     const title = 'Checkout - '
//     const payment = await Payment.findOne({idOrder: req.query.transactionid}).populate('visaIDs')
//     const qtyVisas = payment.visaIDs.length

//     res.render('checkout/retry-email', {payment, title, qtyVisas, transactionid: req.query.transactionid})
//   } catch {
//     req.flash('error_msg', 'Esse pagamento não existe ou já foi concluído')
//     res.redirect('/')
//   }
  

// })

// router.post('/process-payment-retry', async (req, res) => {
//   const { body } = req
//   const { payer } = body

//   const payment = await Payment.findOne({transactionId: req.query.transactionid}).populate('visaIDs')
//   const visas = payment.visaIDs
//   const qtyVisas = visas.length

//   const updatedPayment = await mercadopago.payment.create({
//     transaction_amount: qtyVisas * 147.00,
//     token: body.token,
//     description: 'Solicitação de Autorização de Viagem - Canadá',
//     installments: Number(body.installments),
//     payment_method_id: body.paymentMethodId,
//     issuer_id: body.issuerId,
//     notification_url: "https://etacanadense.com.br/checkout/webhooks?source_news=webhook",
//     payer: {
//       email: payer.email,
//       identification: {
//         type: payer.identification.type,
//         number: payer.identification.number
//       }
//     }
//   })
  
//   payment.transaction_amount = updatedPayment.response.transaction_amount
//   payment.transactionId = updatedPayment.response.id
//   payment.docType = payer.identification.type
//   payment.docNumber = payer.identification.number
//   payment.status = updatedPayment.response.status
//   payment.status_details = updatedPayment.response.status_detail
//   payment.payment_type_id = updatedPayment.response.payment_type_id
//   payment.installments = updatedPayment.response.installments
//   payment.createdAt = new Date(updatedPayment.response.date_created)

//   const savedPayment = await payment.save()

//   for (const visa of visas) {
//     Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } });

//     if (visa) {
//       await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
//       if(savedPayment.status === 'approved') {
//         transporter.use('compile', hbs(handlebarOptions))

//         const mailOptions = {
//           from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
//           to: process.env.CANADENSE_RECEIVER_MAIL,
//           subject: 'Pagamento aprovado',
//           template: 'pagamento-aprovado',
//           context: {
//             nome: visa.firstName,
//             codeETA: visa.codeETA,
//           }
//         }

//         transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
//           if(err) {
//             console.log("Pagamento aprovado (cartão outras tentativas): " + new Date())
//             console.log(err)
//           } else {
//             console.log({
//               message: `Pagamento aprovado (cartão outras tentativas): ${new Date()}`,
//               response,
//               envelope,
//               messageId
//             })
//           }
//         })
//       } else if (savedPayment.status === 'rejected' || savedPayment.status === 'cancelled') {
//         const visas = savedPayment.visaIDs
//         const qtyVisas = visas.length
        
//         let linkStripe
//         switch (qtyVisas) {
//           case 1:
//             linkStripe = "https://buy.stripe.com/eVa3gb94k9EF52w002"
//             break

//           case 2:
//             linkStripe = "https://buy.stripe.com/dR69Ez6WccQR66A6or"
//             break
          
//           case 3:
//             linkStripe = "https://buy.stripe.com/eVag2X5S8cQRfHa5ko"
//             break

//           case 4:
//             linkStripe = "https://buy.stripe.com/fZe8Ava8o045fHa5kp"
//             break
          
//           case 5:
//             linkStripe = "https://buy.stripe.com/cN27wr4O4bMNfHa4gm"
//             break

//           case 6:
//             linkStripe = "https://buy.stripe.com/8wM5ojeoEaIJbqU8wD"
//             break
            
//           default:
//             linkStripe = "https://buy.stripe.com/3cs1833K0cQR1QkdQQ"
//             break
//         }
        
//         transporter.use('compile', hbs(handlebarOptions))

//         const mailOptions = {
//             from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
//             to: visa.contactEmail,
//             bcc: process.env.CANADENSE_RECEIVER_MAIL,
//             subject: 'Pagamento recusado',
//             template: 'pagamento-recusado',
//             context: {
//               nome: visa.firstName,
//               codeETA: visa.codeETA,
//               transactionid: savedPayment.transactionId,
//               linkStripe
//             }
//         }

//         transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
//           if(err) {
//             console.log("Pagamento recusado (cartão outras tentativas): " + new Date())
//             console.log(err)
//           } else {
//             console.log({
//               message: `Pagamento recusado (cartão outras tentativas): ${new Date()}`,
//               response,
//               envelope,
//               messageId
//             })
//           }
//         })
//       }
//     }
//   }

//   res.status(200).json({
//     id: updatedPayment.response.id,
//     status: updatedPayment.response.status,
//     detail: updatedPayment.response.status_detail
//   })
// })

// router.post('/process-payment-pix-retry', async (req, res) => {
//   const requestBody = req.body

//   const payment = await Payment.findOne({transactionId: req.query.transactionid}).populate('visaIDs')
//   const visas = payment.visaIDs
//   const qtyVisas = visas.length

//   mercadopago.payment.create({
//     transaction_amount: qtyVisas * 139.65,
//     payment_method_id: "pix",
//     description: 'Solicitação de Autorização de Viagem - Canadá',
//     notification_url: "https://etacanadense.com.br/checkout/webhooks?source_news=webhook",
//     payer: {
//       email: requestBody.payer.email,
//       first_name: requestBody.payer.firstName,
//       last_name: requestBody.payer.lastName,
//       identification: {
//         type: requestBody.payer.identification.type,
//         number: requestBody.payer.identification.number,
//       }
//     }
//   }).then(async (response) => {
//     try {
//       const { response: data } = response
//       payment.transaction_amount = data.transaction_amount,
//       payment.transactionId = data.id,
//       payment.docType = requestBody.payer.identification.type,
//       payment.docNumber = requestBody.payer.identification.number,
//       payment.status = data.status,
//       payment.status_details = data.status_detail,
//       payment.payment_type_id = data.payment_type_id,
//       payment.installments = data.installments,
//       payment.qrCode = data.point_of_interaction.transaction_data.qr_code,
//       payment.qrCodeBase64 = data.point_of_interaction.transaction_data.qr_code_base64,
//       payment.visaIDs = visas,
//       payment.createdAt = new Date(data.date_created)
  
//       const savedPayment = await payment.save()

//       for (const element of visas) {
//         const visa = await Visa.findOne({ _id: element })
  
//         if (visa) {
//           await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
//           if(data.status === 'approved') {
//             transporter.use('compile', hbs(handlebarOptions))
    
//             const mailOptions = {
//                 from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
//                 to: process.env.CANADENSE_RECEIVER_MAIL,
//                 subject: 'Pagamento aprovado',
//                 template: 'pagamento-aprovado',
//                 context: {
//                   nome: visa.firstName,
//                   codeETA: visa.codeETA,
//                 }
//             }
    
//             transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
//               if(err) {
//                 console.log("Pagamento aprovado (pix outras tentativas): " + new Date())
//                 console.log(err)
//               } else {
//                 console.log({
//                   message: `Pagamento aprovado (pix outras tentativas): ${new Date()}`,
//                   response,
//                   envelope,
//                   messageId
//                 })
//               }
//             })
//           }
//         }
//       }

//       const qr_code_base = data.point_of_interaction.transaction_data.qr_code_base64
//       req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {qr_code_base})
//       res.status(200).json({
//         id: data.id,
//         status: data.status,
//         detail: data.status_detail,
//         qrCode: data.point_of_interaction.transaction_data.qr_code,
//         qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64
//       })

//     } catch (error){
//       console.log(error)
//       const { errorMessage, errorStatus }  = validateError(error)
//       res.status(errorStatus).json({ error_message: errorMessage })
//     }
//   })
// })

// router.get('/abandoned', async (req, res) => {
//   try {
//     const title = 'Checkout - '
//     const payment = await Payment.findOne({idCheckout: req.query.idcheckout}).populate('visaIDs')
//     const qtyVisas = payment.visaIDs.length

//     res.render('checkout/abandoned', {payment, title, publicKey, qtyVisas, idcheckout: req.query.idcheckout})
//   } catch {
//     req.flash('error_msg', 'Esse pagamento não existe ou já foi concluído')
//     res.redirect('/')
//   }
// })

// router.post('/process-payment-abandoned', async (req, res) => {
//   const { body } = req
//   const { payer } = body

//   const payment = await Payment.findOne({idCheckout: req.query.idcheckout}).populate('visaIDs')
//   const visas = payment.visaIDs
//   const qtyVisas = visas.length

//   const updatedPayment = await mercadopago.payment.create({
//     transaction_amount: qtyVisas * 147.00,
//     token: body.token,
//     description: 'Solicitação de Autorização de Viagem - Canadá',
//     installments: Number(body.installments),
//     payment_method_id: body.paymentMethodId,
//     issuer_id: body.issuerId,
//     notification_url: "https://etacanadense.com.br/checkout/webhooks?source_news=webhook",
//     payer: {
//       email: payer.email,
//       identification: {
//         type: payer.identification.type,
//         number: payer.identification.number
//       }
//     }
//   })
  
//   payment.transaction_amount = updatedPayment.response.transaction_amount
//   payment.transactionId = updatedPayment.response.id
//   payment.docType = payer.identification.type
//   payment.docNumber = payer.identification.number
//   payment.status = updatedPayment.response.status
//   payment.status_details = updatedPayment.response.status_detail
//   payment.payment_type_id = updatedPayment.response.payment_type_id
//   payment.installments = updatedPayment.response.installments
//   payment.createdAt = new Date(updatedPayment.response.date_created)

//   const savedPayment = await payment.save()

//   for (const visa of visas) {
//     Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } });

//     if (visa) {
//       await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
//       if(savedPayment.status === 'approved') {
//         transporter.use('compile', hbs(handlebarOptions))

//         const mailOptions = {
//             from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
//             // to: process.env.CANADENSE_RECEIVER_MAIL,
//             subject: 'Pagamento aprovado',
//             template: 'pagamento-aprovado',
//             context: {
//               nome: visa.firstName,
//               codeETA: visa.codeETA,
//             }
//         }

//         transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
//           if(err) {
//             console.log("Pagamento aprovado (cartão checkout abandonado): " + new Date())
//             console.log(err)
//           } else {
//             console.log({
//               message: `Pagamento aprovado (cartão checkout abandonado): ${new Date()}`,
//               response,
//               envelope,
//               messageId
//             })
//           }
//         })
//       } else if (savedPayment.status === 'rejected' || savedPayment.status === 'cancelled') {
//         const visas = savedPayment.visaIDs
//         const qtyVisas = visas.length
//         let linkStripe

//         switch (qtyVisas) {
//           case 1:
//             linkStripe = "https://buy.stripe.com/eVa3gb94k9EF52w002"
//             break

//           case 2:
//             linkStripe = "https://buy.stripe.com/dR69Ez6WccQR66A6or"
//             break
          
//           case 3:
//             linkStripe = "https://buy.stripe.com/eVag2X5S8cQRfHa5ko"
//             break

//           case 4:
//             linkStripe = "https://buy.stripe.com/fZe8Ava8o045fHa5kp"
//             break
          
//           case 5:
//             linkStripe = "https://buy.stripe.com/cN27wr4O4bMNfHa4gm"
//             break

//           case 6:
//             linkStripe = "https://buy.stripe.com/8wM5ojeoEaIJbqU8wD"
//             break
            
//           default:
//             linkStripe = "https://buy.stripe.com/3cs1833K0cQR1QkdQQ"
//             break
//         }
        
//         transporter.use('compile', hbs(handlebarOptions))

//         const mailOptions = {
//             from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
//             to: visa.contactEmail,
//             bcc: process.env.CANADENSE_RECEIVER_MAIL,
//             subject: 'Pagamento recusado',
//             template: 'pagamento-recusado',
//             context: {
//               nome: visa.firstName,
//               codeETA: visa.codeETA,
//               transactionid: savedPayment.transactionId,
//               linkStripe
//             }
//         }

//         transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
//           if(err) {
//             console.log("Pagamento recusado (cartão abandonado): " + new Date())
//             console.log(err)
//           } else {
//             console.log({
//               message: `Pagamento recusado (cartão abandonado): ${new Date()}`,
//               response,
//               envelope,
//               messageId
//             })
//           }
//         })
//       }
//     }
//   }

//   res.status(200).json({
//     id: updatedPayment.response.id,
//     status: updatedPayment.response.status,
//     detail: updatedPayment.response.status_detail
//   })
// })

// router.post('/process-payment-pix-abandoned', async (req, res) => {
//   const requestBody = req.body

//   const payment = await Payment.findOne({idCheckout: req.query.idcheckout}).populate('visaIDs')
//   const visas = payment.visaIDs
//   const qtyVisas = visas.length

//   mercadopago.payment.create({
//     transaction_amount: qtyVisas * 139.65,
//     payment_method_id: "pix",
//     description: 'Solicitação de Autorização de Viagem - Canadá',
//     notification_url: "https://etacanadense.com.br/checkout/webhooks?source_news=webhook",
//     payer: {
//       email: requestBody.payer.email,
//       first_name: requestBody.payer.firstName,
//       last_name: requestBody.payer.lastName,
//       identification: {
//         type: requestBody.payer.identification.type,
//         number: requestBody.payer.identification.number,
//       }
//     }
//   }).then(async (response) => {
//     try {
//       const { response: data } = response
//       payment.transaction_amount = data.transaction_amount,
//       payment.transactionId = data.id,
//       payment.docType = requestBody.payer.identification.type,
//       payment.docNumber = requestBody.payer.identification.number,
//       payment.status = data.status,
//       payment.status_details = data.status_detail,
//       payment.payment_type_id = data.payment_type_id,
//       payment.installments = data.installments,
//       payment.qrCode = data.point_of_interaction.transaction_data.qr_code,
//       payment.qrCodeBase64 = data.point_of_interaction.transaction_data.qr_code_base64,
//       payment.visaIDs = visas,
//       payment.createdAt = new Date(data.date_created)

//       const savedPayment = await payment.save()

//       for (const element of visas) {
//         const visa = await Visa.findOne({ _id: element })
  
//         if (visa) {
//           await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
//           if(data.status === 'approved') {
//             transporter.use('compile', hbs(handlebarOptions))
    
//             const mailOptions = {
//                 from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
//                 to: process.env.CANADENSE_RECEIVER_MAIL,
//                 subject: 'Pagamento aprovado',
//                 template: 'pagamento-aprovado',
//                 context: {
//                   nome: visa.firstName,
//                   codeETA: visa.codeETA,
//                 }
//             }
    
//             transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
//               if(err) {
//                 console.log("Pagamento aprovado (pix abandonado): " + new Date())
//                 console.log(err)
//               } else {
//                 console.log({
//                   message: `Pagamento aprovado (pix abandonado): ${new Date()}`,
//                   response,
//                   envelope,
//                   messageId
//                 })
//               }
//             })
//           }
//         }
//       }

//       const qr_code_base = data.point_of_interaction.transaction_data.qr_code_base64
//       req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {qr_code_base})
//       res.status(200).json({
//         id: data.id,
//         status: data.status,
//         detail: data.status_detail,
//         qrCode: data.point_of_interaction.transaction_data.qr_code,
//         qrCodeBase64: data.point_of_interaction.transaction_data.qr_code_base64
//       })

//     } catch (error){
//       console.log(error)
//       const { errorMessage, errorStatus }  = validateError(error)
//       res.status(errorStatus).json({ error_message: errorMessage })
//     }
//   })
// })


////////////////
// AUXILIARES //
////////////////
router.get('/verify-pix-payment', (req, res) => {
  Payment.findOne({idOrder: req.query.idOrder}).then((response) => {
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


//////////////
// WEBHOOKS //
//////////////
router.post('/webhook', async (req, res) => {
  const { body } = req
  const payment = await Payment.findOne({idOrder: body.data.id})

  if (body.event === "OrderApproved" || body.event === "OrderPaidByPix") {
    payment.status = 'approved'
    payment.status_details = 'accredited'
    payment.payment_type_id = body.event === "OrderPaidByPix" ? "bank_transfer" : "credit_card"

    for (const element of payment.visaIDs) {
      const visa = await Visa.findOne({ _id: element })
        
      if (visa) {
        transporter.use('compile', hbs(handlebarOptions))
    
        transporter.sendMail({
            from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
            to: visa.contactEmail,
            bcc: process.env.CANADENSE_RECEIVER_MAIL,
            subject: `Confirmação de Recebimento Código ${visa.codeETA} - Autorização Eletrônica de Viagem Canadense`,
            template: 'aviso-eta',
          }, (err, {response, envelope, messageId}) => {
            if(err) {
              console.log("Confirmação de recebimento (Webhook): " + new Date())
              console.log(err)
            } else {
              console.log({
                message: `Confirmação de recebimento (Webhook): ${new Date()}`,
                response, envelope, messageId
              })
            }
          }
        )
    
        transporter.sendMail({
            from: `eTA Canadense <${process.env.CANADENSE_SENDER_MAIL}>`,
            to: process.env.CANADENSE_RECEIVER_MAIL,
            subject: 'Pagamento aprovado',
            template: 'pagamento-aprovado',
            context: {
              nome: visa.firstName,
              codeETA: visa.codeETA,
            }
          }, (err, {response, envelope, messageId}) => {
            if(err) {
              console.log("Pagamento aprovado (Webhook): " + new Date())
              console.log(err)
            } else {
              console.log({
                message: `Pagamento aprovado (Webhook): ${new Date()}`,
                response, envelope, messageId
              })
            }
          }
        )
      }
    }

    payment.save().then(() => {
      res.status(200).end()
    }).catch((e) => {
      console.error(e)
      res.status(409).end()
    })

  } else {
    const visas = payment.visaIDs
    const qtyVisas = visas.length

    let linkStripe
    const links = {
        1: "https://buy.stripe.com/eVa3gb94k9EF52w002",
        2: "https://buy.stripe.com/dR69Ez6WccQR66A6or",
        3: "https://buy.stripe.com/eVag2X5S8cQRfHa5ko",
        4: "https://buy.stripe.com/fZe8Ava8o045fHa5kp",
        5: "https://buy.stripe.com/cN27wr4O4bMNfHa4gm",
        6: "https://buy.stripe.com/8wM5ojeoEaIJbqU8wD",
    }
    linkStripe = links[qtyVisas] || "https://buy.stripe.com/3cs1833K0cQR1QkdQQ"
                  
    for (const element of payment.visaIDs) {
      const visa = await Visa.findOne({ _id: element })
        
      if (visa) {
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
            transactionid: payment.idOrder,
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
              response, envelope, messageId
            })
          }
        })

        payment.save().then(() => {
          res.status(200).end()
        }).catch((e) => {
          console.error(e)
          res.status(409).end()
        })
      }
    }
  }
  res.status(200).send("OK")
})

module.exports = router
