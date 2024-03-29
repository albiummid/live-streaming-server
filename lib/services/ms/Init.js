const mediasoup = require('mediasoup');
const mediasoupOptions = require('./options');
async function boot(){
    // Set up mediasoup
    const worker = await mediasoup.createWorker(mediasoupOptions.worker);
    const router = await worker.createRouter(mediasoupOptions.router);

    return {
        worker,
        router
    }
}

module.exports = {
    boot
};