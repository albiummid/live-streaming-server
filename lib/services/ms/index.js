async function boot(){
    const init = await require('./Init.js').boot();
    return {
        msWorker: init.worker,
        msRouter: init.router
    }
}

module.exports = { 
    ms: boot
};