const mongoose = require("mongoose")
const Schema = mongoose.Schema

const Visa = new Schema({
    representative: {
        type: Number,
        required: true
    },
    relationship: {
        type: String
    },
    payed: {
        type: Number
    },
    representativeName: {
        type: String
    },
    representativeSurname: {
        type: String
    },
    representativeOrgName: {
        type: String
    },
    representativeAddress: {
        type: String
    },
    representativeEmail: {
        type: String
    },
    representativeNumTel: {
        type: String
    },
    representativeNumIDmebro: {
        type: String
    },
    representativeProvOrTer: {
        type: String
    },
    representativeCodpostal: {
        type: String
    },
    document: {
        type: String,
        required: true
    },
    passportBrazil: {
        type: Number,
        required: true
    },
    USCIS: {
        type: Number,
        required: true
    },
    airplane: {
        type: Number,
        required: true
    },
    canadaVisa: {
        type: Number,
        required: true
    },
    numVisaNonImmigrate: {
        type: String
    },
    dayVisaNonImmigrate: {
        type: String
    },
    monthVisaNonImmigrate: {
        type: String
    },
    yearVisaNonImmigrate: {
        type: String
    },
    numPassport: {
        type: String,
        required: true
    },
    doiDay: {
        type: String,
        required: true
    },
    doiMonth: {
        type: String,
        required: true
    },
    doiYear: {
        type: String,
        required: true
    },
    doeDay: {
        type: String,
        required: true
    },
    doeMonth: {
        type: String,
        required: true
    },
    doeYear: {
        type: String,
        required: true
    },
    firstName: {
        type: String,
        required: true
    },
    surname: {
        type: String,
        required: true
    },
    dobDay: {
        type: String,
        required: true
    },
    dobMonth: {
        type: String,
        required: true
    },
    dobYear: {
        type: String,
        required: true
    },
    gender: {
        type: String,
        required: true
    },
    countryBirth: {
        type: String,
        required: true
    },
    cityBirth: {
        type: String,
        required: true
    },
    maritalStatus: {
        type: String,
        required: true
    },
    appliedToCanada: {
        type: Number,
        required: true
    },
    personalUCI: {
        type: String
    },
    occupation: {
        type: Number,
        required: true
    },
    employmentTitle: {
        type: Number
    },
    employmentCompanyName: {
        type: String
    },
    employmentCountry: {
        type: String
    },
    employmentCity: {
        type: String
    },
    employmentFromDateYear: {
        type: Number
    },
    travelWhen: {
        type: Number,
        required: true
    },
    travelDay: {
        type: Number
    },
    travelMonth: {
        type: Number
    },
    travelYear: {
        type: Number
    },
    travelTimeHour: {
        type: Number
    },
    travelTimeMinute: {
        type: Number
    },
    travelTimeZone: {
        type: Number
    },
    refusedVisaToCanda: {
        type: Number,
        required: true
    },
    refusedVisaToCandaDetails: {
        type: String
    },
    criminalOffenceAnywhere: {
        type: Number,
        required: true
    },
    criminalOffenceAnywhereDetails: {
        type: String,
        required: true
    },
    tuberculosis: {
        type: Number,
        required: true
    },
    tuberculosisResultCareWorker: {
        type: Number
    },
    diagnosedWithTuberculosis: {
        type: Number
    },
    theseConditions: {
        type: Number,
        required: true
    },
    canadaDuringStayDetails: {
        type: String,
        required: true
    },
    agreeCheck: {
        type: String,
        required: true
    },
    consentAndDeclaration: {
        type: String,
        required: true
    }
})

mongoose.model("visa", Visa)