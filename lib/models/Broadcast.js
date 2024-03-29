const mongoose = require('mongoose');

const broadcastSchema = new mongoose.Schema({

    routerId: {
        type: String,
        required: true,
    },

    meta: {
        type: Object,
    },

    timeBook: {
        type: Object
    },

    status: {
        type: String,
        enum: ['On Air', 'Ended'],
        default: 'On Air'
    }

}, {
    timestamps: true
});

const Broadcast = mongoose.model('Broadcast', broadcastSchema);

module.exports = Broadcast;