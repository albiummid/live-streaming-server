const mongoose = require('mongoose');

const producerSchema = new mongoose.Schema({

    broadcastId: {
        type: String,
        required: true,
    },

    transportId: {
        type: String
    },

    producerId: {
        type: String
    },

    kind: {
      type: String
    },

    rtpParamters: {
      type: Object
    },

    timeBook: {
        type: Object
    }

}, {
    timestamps: true
});

const Producer = mongoose.model('Producer', producerSchema);

module.exports = Producer;