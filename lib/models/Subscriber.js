const mongoose = require('mongoose');

const subscriberSchema = new mongoose.Schema({

    broadcastId: {
        type: String,
        required: true,
    },

    subscriberId: {
      type: String,
      required: true
    },

    rtpCapabilities: {
      type: Object
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

const Subscriber = mongoose.model('Subscriber', subscriberSchema);

module.exports = Subscriber;