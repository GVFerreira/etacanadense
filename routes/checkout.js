const express = require('express')
const router = express.Router()

const mongoose = require('mongoose')
require('../models/Visa')
const Visa = mongoose.model("visa")
require('../models/Payment')
const Payment = mongoose.model("payment")
require('../models/Session')
const Session = mongoose.model("session")

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
    const { visa_ids:visas } = await Session.findOne({session_id: req.query.session_id})
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
            "installments": 6,
            "total": qtyVisas * 147,
            "format": 2 
        })
      })
      const { data:installments } = await reqInstallments.json()

      res.render('checkout/index', {title, sessionData, visas, visasData, qtyVisas, installments, session_id: req.query.session_id})

    } catch (err) {
      console.log("Erro ao carregar o checkout (index): " + new Date())
      console.log(err)
      req.flash('error_msg', 'Não foi possível carregar o checkout. Se o erro persistir, entre em contato através do e-mail contato@etacanadense.com.br')
      res.redirect('/')
    }

  } else {
    req.flash('error_msg', 'Os campos na etapa 4 devem ser preenchidos.')
    res.redirect(`/aplicacao?step=4`)
  }
})

router.get('/remove-visa', async (req, res) => {
  const session_id = req.query.session_id
  const visa_id = req.query.visa_id

  if(session_id) {
    try {
      await Session.findOneAndUpdate(
        { session_id },
        { $pull: { visa_ids: visa_id } },
        { new: true } 
      )

      req.flash('success_msg', 'Aplicação excluída com sucesso.')
      res.redirect(`/checkout?session_id=${session_id}`)
    
    } catch (err) {
      console.log(err)
      req.flash('error_msg', 'Não foi possível remover este item. Tente novamente.')
      res.redirect(`/checkout?session_id=${session_id}`)
    }
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

  const { visa_ids:visas } = await Session.findOne({session_id: req.query.session_id})
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
            "price": pricePerVisa(),
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

          res.redirect(`/checkout/obrigado?status_detail=accredited&status=approved&transaction_id=${savedPayment._id}`)
          
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
              transactionid: savedPayment._id,
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

      res.redirect(`/checkout/recusado?status_detail='cc_rejected_other_reason'&status=rejected&transaction_id=${savedPayment._id}`)

    }
  } catch (err) {
    console.log(err)
    req.flash('error_msg', 'Não foi possível processar seu pagamento. Tente novamente.')
    res.redirect('/checkout')
  }
})

router.post("/process-payment-pix", async (req, res) => {
  const {
    identificationType,
    identificationNumber
  } = req.body

  const { visa_ids:visas } = await Session.findOne({session_id: req.query.session_id})
  const qtyVisas = visas.length

  try {
    const payment = await Payment.findOne({idCheckout: req.session.sessionCheckout})
    
    function expirateDate() {
      let currentDate = new Date()
      currentDate.setHours(currentDate.getHours() + 12)
      let expirationDate = currentDate.toISOString().slice(0, 19).replace('T', ' ')
      return expirationDate
    }

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
            "price": 139.65,
            "digital_product": 1
          },
        ],
        "customer_id": payment.idClient
      })
    })
    const order = await newOrder.json()

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
      
      const savedPayment = await newPayment.save()

      for (const element of visas) {
        const visa = await Visa.findOne({ _id: element })

        if (visa) {
          await Visa.updateOne({ _id: visa._id }, { $set: { pagamento: savedPayment._id } })
        }
      }

      const qr_code_base = pixPayment.data.pix_qrcode
      req.session.aplicacaoStep = Object.assign({}, req.session.aplicacaoStep, {qr_code_base})
      res.status(201).redirect(`/checkout/pix?id=${savedPayment._id}&status=pending&qr_code=${pixPayment.data.pix_emv}`)

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
// Tentativa após pagamento recusado, mesma sessão
router.get('/retry/:id', async (req, res) => {
  try {
    const title = 'Checkout - '
    const payment = await Payment.findOne({_id: req.params.id}).populate('visaIDs') //retorna o pagamento pelo id do pedido
    const qtyVisas = payment.visaIDs.length

    // verifica se o pagamento existe
    if (!payment) {
      req.flash('error_msg', 'Esse pagamento não existe.')
      res.redirect('/')
    } else {
      // retorna as parcelas, conforme o valor
      const reqInstallments = await fetch(`${process.env.BASE_URL}/payment/installments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            "access-token": process.env.APPMAX_ACCESS_TOKEN,
            "installments": 6,
            "total": qtyVisas * 147,
            "format": 2 
        })
      })
      const { data:installments } = await reqInstallments.json()
      
      res.render('checkout/retry', {payment, title, qtyVisas, installments, transactionid: req.params.id})
    } 
  } catch (e) {
    console.log(e)
    req.flash('error_msg', 'Não foi possível encontrar este pagamento')
    res.redirect('/')
  }
})

// Através do link do e-mail, pagamentos recusados e lembrete de pagamento
router.get('/retry-email', async (req, res) => {
  try {
    const title = 'Checkout - '
    const payment = await Payment.findOne({_id: req.query.transactionid}).populate('visaIDs') //retorna o pagamento pelo id do pedido
    const qtyVisas = payment.visaIDs.length
    
    // verifica se o pagamento existe
    if (!payment) {
      req.flash('error_msg', 'Esse pagamento não existe.')
      res.redirect('/')
    } else {
      // retorna as parcelas, conforme o valor
      const reqInstallments = await fetch(`${process.env.BASE_URL}/payment/installments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            "access-token": process.env.APPMAX_ACCESS_TOKEN,
            "installments": 6,
            "total": qtyVisas * 147,
            "format": 2 
        })
      })
      const { data:installments } = await reqInstallments.json()
  
      res.render('checkout/retry', {payment, title, qtyVisas, installments, transactionid: req.query.transactionid})
    } 
  } catch (e) {
    req.flash('error_msg', 'Não foi prossível encontrar este pagamento. Entre em contato com o suporte.')
    res.redirect('/')
  }
})

router.post('/process-payment-retry', async (req, res) => {
  const {
    cardholderName,
    identificationType,
    identificationNumber,
    cardNumber,
    expirationMonth,
    expirationYear,
    securityCode,
    installmentsInput,
    transactionid
  } = req.body

  try {
    const payment = await Payment.findOne({_id: transactionid})

    const visas = payment.visaIDs
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
            "price": pricePerVisa(),
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
        { idCheckout: payment.idCheckout },
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

          res.redirect(`/checkout/obrigado?status_detail=accredited&status=approved&transaction_id=${savedPayment._id}`)
          
        }
      }

    } else {
      const newPayment = await Payment.findOneAndUpdate(
        { idCheckout: payment.idCheckout },
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
              transactionid: savedPayment._id,
              linkStripe
            }
          }

          transporter.sendMail(mailOptions, (err, {response, envelope, messageId}) => {
            if(err) {
              console.log(`Pagamento recusado (cartão outra tentativa): ${new Date()}`)
              console.log(err)
            } else {
              console.log({
                message: `Pagamento recusado (cartão outra tentativa): ${new Date()}`,
                response, envelope, messageId
              })
            }
          })
        }
      }

      res.redirect(`/checkout/recusado?status_detail='cc_rejected_other_reason'&status=rejected&transaction_id=${savedPayment._id}`)

    }
  } catch (err) {
    console.log(err)
    req.flash('error_msg', 'Não foi possível localizar seu pagamento anterior')
    res.redirect('/')
  }
})

router.post('/process-payment-pix-retry', async (req, res) => {
  const {
    identificationType,
    identificationNumber,
    transactionid
  } = req.body

  try {
    const payment = await Payment.findOne({idOrder: transactionid})
    
    const visas = payment.visaIDs
    const qtyVisas = visas.length

    function expirateDate() {
      let currentDate = new Date()
      currentDate.setHours(currentDate.getHours() + 12)
      let expirationDate = currentDate.toISOString().slice(0, 19).replace('T', ' ')
      return expirationDate
    }

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
            "price": 139.65,
            "digital_product": 1
          },
        ],
        "customer_id": payment.idClient
      })
    })
    const order = await newOrder.json()

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
      res.status(201).redirect(`/checkout/pix?id=${savedPayment._id}&status=pending&qr_code=${pixPayment.data.pix_emv}`)

    } else {
      console.log("Erro ao gerar PIX (primeiro checkout): " + new Date())
      console.log(err)

      req.flash('error_msg', "Ocorreu um erro ao gerar seu PIX QR Code")
      res.redirect('/checkout')
    }
  } catch (err) {
    console.log(err)
    console.log("Erro ao criar o pagamento via PIX (primeiro checkout): " + new Date())
    res.redirect('/checkout')
  }
})


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

  if(payment.status === 'approved') {
    return res.status(200)
  } else {
    if(body.event === "OrderApproved" || body.event === "OrderPaidByPix") {
      payment.status = 'approved'
      payment.status_details = 'accredited'
      payment.payment_type_id = body.event === "OrderPaidByPix" ? "bank_transfer" : "credit_card"
  
      for (const element of payment.visaIDs) {
        const visa = await Visa.findOne({ _id: element })
          
        if (visa) {
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
                console.log(`Pagamento aprovado (Webhook): ${new Date()}`)
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
    }

    res.status(202).send("OK")
  }
})

router.post('/webhook-rejected', async (req, res) => {
  const { body } = req
  const payment = await Payment.findOne({idOrder: body.data.id})

  if(payment.status === 'approved') {
    return res.status(200)
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
    res.status(202).send("OK")
  }
})

module.exports = router
