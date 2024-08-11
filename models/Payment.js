const mongoose = require("mongoose")
const Schema = mongoose.Schema

const Payment = new Schema({
    idCheckout: {
        type: String
    },
    idClient: {
        type: Number
    },
    idOrder: {
        type: String
    },
    transaction_amount: {
        type: Number
    },
    transactionId: {
        type: String
    },
    docType: {
        type: String,
        default: 'CPF'
    },
    docNumber: {
        type: String
    },
    status: {
        type: String,
        required: true
    },
    status_details: {
        type: String
    },
    payment_type_id: {
        type: String
    },
    installments: {
        type: Number
    },
    qrCode: {
        type: String
    },
    qrCodeBase64: {
        type: String
    },
    visaIDs: [{ 
        type: Schema.Types.ObjectId,
        ref: 'visa'
    }],
    createdAt: {
        type: Date,
        required: true,
        default: Date.now
    }
})

mongoose.model("payment", Payment)