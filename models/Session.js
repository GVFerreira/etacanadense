const mongoose = require("mongoose")
const Schema = mongoose.Schema

const Session = new Schema({
    session_id: {
        type: String,
        required: true
    },
    visa_ids: [{ 
        type: Schema.Types.ObjectId,
        ref: 'visa'
    }],
    payment_id: { 
        type: Schema.Types.ObjectId,
        ref: 'payment'
    },
    created_at: {
        type: Date,
        default: Date.now
    }
})

mongoose.model("session", Session)