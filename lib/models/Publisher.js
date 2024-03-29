const mongoose = require('mongoose');

const publisherSchema = new mongoose.Schema({

    broadcastId: {
        type: String,
        required: true,
    },

    transportId: {
        type: String
    },

    meta: {
        type: Object,
    },

    timeBook: {
        type: Object
    }

}, {
    timestamps: true
});

const Publisher = mongoose.model('Publisher', publisherSchema);

module.exports = Publisher;