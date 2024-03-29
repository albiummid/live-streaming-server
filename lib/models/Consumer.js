const mongoose = require('mongoose');

const consumerSchema = new mongoose.Schema({

    broadcastId: {
        type: String,
        required: true,
    },

    transportId: {
        type: String // in server webRtcTransport, in device recvTransport
    },

    consumerId: {
      type: String // will be added while consuming
    },

    subscriberId: {
        type: String
    },

    kind: {
      type: String
    },

    timeBook: {
        type: Object
    }

}, {
    timestamps: true
});

const Consumer = mongoose.model('Consumer', consumerSchema);

module.exports = Consumer;