const mongoose = require("mongoose")
const Schema = mongoose.Schema

const Payment = new Schema({
    transaction_amount: {
        type: Number,
        required: true
    },
    transactionId: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        required: true,
    },
    status_details: {
        type: String,
        required: true,
    },
    payment_type_id: {
        type: String,
        required: true
    },
    installments: {
        type: Number
    },
    qrCode: {
        type: String,
    },
    qrCodeBase64: {
        type: String,
    },
    visaIDs: [{ 
        type: Schema.Types.ObjectId,
        ref: 'visa'
    }],
    createdAt: {
        type: Date,
        default: Date.now()
    }
})

mongoose.model("payment", Payment)