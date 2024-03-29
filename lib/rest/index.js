const router = require("express").Router();
const BroadcastService = require("../../lib/services/broadcast/BroadcastService.js");

router.post("/broadcast/initiate", async (req, res) => {

    try {
        const { WORKER, ROUTER } = req;
        const broadcast = await BroadcastService.initiateBroadcast({
            worker: WORKER, router: ROUTER
        });

        res.send({
            kind: 'success',
            broadcast: {
                id: broadcast.uuid
            },
            router: {
                id: ROUTER.id,
                rtpCapabilities: ROUTER.rtpCapabilities
            }
            
        });

    } catch (error) {
        console.log(error);
        res.send({
            kind: "error",
            error: error.message,
            in: "broadcast::initiate ==> catch block",
            stack: error.stack
        });
    }

});

router.post("/broadcast/publisher/register", async (req, res) => {
    
        try {
            const { WORKER, ROUTER } = req;
            const { broadcastId } = req.body;
            const publisher = await BroadcastService.registerPublisher({
                worker: WORKER, router: ROUTER, broadcastId
            });
    
            res.send({
                kind: 'success',
                broadcast: {
                    id: broadcastId
                },
                router: {
                    id: ROUTER.id,
                    rtpCapabilities: ROUTER.rtpCapabilities
                },
                publisher: publisher.publisher,
                transport: publisher.transport
                
            });
    
        } catch (error) {
            console.log(error);
            res.send({
                kind: "error",
                error: error.message,
                in: "broadcast::registerPublisher ==> catch block",
                stack: error.stack
            });
        }
    
});

router.get("/controller", async (req, res) => {
    try {
        console.log('CONTROLLER INFO REQ');
        const { ROUTER } = req;
        res.send({
            kind: 'success',
            router: {
                id: ROUTER.id,
                rtpCapabilities: ROUTER.rtpCapabilities
            }
        });
    } catch (error) {
        console.log(error);
        res.send({
            kind: "error",
            error: error.message,
            in: "router::get ==> catch block",
            stack: error.stack
        });
    }
});


module.exports = router;