const Broadcast = require('../../models/Broadcast');
const Publisher = require('../../models/Publisher');
const { v4: uuidv4 } = require('uuid');
const ndb = require('../ndb');


async function initiateBroadcast(payload){
    const { 
        worker, router 
    } = payload;

    if(!worker || !router){
        throw new Error('PARAMS_MISSING');
    }

    const meta = {
        transmission: {
            worker: worker,
            router: router,
        }
    }

    const broadcast = new Broadcast({
        uuid: uuidv4(),
        publishers: [],
        subscribers: [],
        meta,
        timeBook: {
            startedAt: new Date(),
            endedAt: null
        },
        status: 'On Air'
    });

    if(await ndb.set('broadcasts', broadcast.uuid, broadcast)){
        return await broadcast.save();
    }
    // if the broadcast is not set in the ndb, then it is not set in the database
    throw new Error('BROADCAST_INITIATION_FAILED');

}

async function registerPublisher(payload){
    const {
        worker, router, broadcastId
    } = payload;
    console.log(broadcastId);

    if(!worker || !router || !broadcastId){
        throw new Error('PARAMS_MISSING');
    }

    const broadcast = await Broadcast.findOne({uuid: broadcastId});
    if(!broadcast){
        throw new Error('BROADCAST_NOT_FOUND');
    }

    const meta = {
        transmission: {
            worker: worker,
            router: router,
        }
    }

    const nid = uuidv4();
    const webRtcTransport = await router.createWebRtcTransport({
        listenIps: [
          {
            ip: '0.0.0.0',
            announcedIp: null,
          },
        ],
        enableUdp: true,
        enableTcp: true,
        preferUdp: true,
        initialAvailableOutgoingBitrate: 800000,
    });

    // Enlist the publisher in the broadcast
    broadcast.publishers.push({
        id: nid,
        transportId: webRtcTransport.id,
    });

    

    const publisher = new Publisher({
        broadcastId: broadcast.uuid,
        uuid: nid,
        transportId: webRtcTransport.id,
        meta,
        timeBook: {
            startedAt: new Date(),
            endedAt: null
        },
        status: 'On Air'
    });

    const publisherNDBData = {
        broadcastId: broadcast.uuid,
        uuid: nid,
        transportId: webRtcTransport.id,
        transport: webRtcTransport
    }

    if(await ndb.set('publishers', webRtcTransport.id, publisherNDBData)){
        if(await ndb.set('broadcasts', broadcast.uuid, broadcast)){
            await broadcast.save();
            await publisher.save();

            return {
                publisher: {
                    id: nid,
                    transportId: webRtcTransport.id
                },
                transport: {
                    id: webRtcTransport.id,
                    iceParameters: webRtcTransport.iceParameters,
                    iceCandidates: webRtcTransport.iceCandidates,
                    dtlsParameters: webRtcTransport.dtlsParameters
                }
            }
        }
    }
    // if the broadcast is not set in the ndb, then it is not set in the database
    throw new Error('PUBLISHER_REGISTRATION_FAILED');

}


module.exports = {
    initiateBroadcast,
    registerPublisher
}