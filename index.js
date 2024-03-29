global.ndb = {
    workers: {},
    routers: {},
    broadcasts: {},
    publishers: {},
    producers: {},
    subscribers: {},
    consumers: {},
};

let p = 0;

(async () => {
    const express = require("express");
    const mongoose = require("mongoose");
    const http = require("http");
    const socketIO = require("socket.io");
    const { ms } = require("./lib/services/ms");

    const mediasoup = require("mediasoup");
    const mediasoupOptions = require("./options");

    const config = require("./config");
    const { v4: uuidv4 } = require("uuid");

    const Broadcast = require("./lib/models/Broadcast");
    const Publisher = require("./lib/models/Publisher");
    const Producer = require("./lib/models/Producer");
    const Subscriber = require("./lib/models/Subscriber");
    const Consumer = require("./lib/models/Consumer");
    const nativeDB = require("./lib/services/ndb");

    const app = express();
    const server = http.createServer(app);
    const io = socketIO(server, {
        cors: {
            origin: "*",
            methods: ["GET", "POST"],
        },
        path: config.APP.SOCKET_PATH,
    });

    global.io = io;

    app.use(express.json({ limit: "50mb" }));
    app.use(express.urlencoded({ extended: true, limit: "50mb" }));

    mongoose.connect(config.APP.MONGO.URL, {
        useNewUrlParser: true,
        useUnifiedTopology: true,
    });

    const db = mongoose.connection;
    db.on("error", console.error.bind(console, "MongoDB connection error:"));
    db.once("open", () => {
        console.log("MongoDB connected");
    });

    // mediasoup worker
    const worker = await mediasoup.createWorker(mediasoupOptions.worker);

    app.use(config.APP.REST_PATH, require("./lib/rest/index.js"));

    const port = config.APP.PORT || 9010;

    server.listen(port, () => {
        console.log(`Server listening on port ${port}`);
    });

    io.on("connection", (socket) => {
        console.log("New client connected");

        socket.onAny((eventName, payload, cb) => {});

        if (
            socket.request.headers["user-agent"].indexOf(
                "mediasoup-client/v3"
            ) === -1
        ) {
            console.error("Client is not using Mediasoup v3");
        } else {
            console.log("Client is using Mediasoup v3");
        }

        // initiate a new live broadcast
        socket.on("inquireBroadcast", async (payload, callback = () => {}) => {
            try {
                const { originId, broadcastId, localData } = payload;

                // get broadcast from db
                const broadcast = await Broadcast.findOne({
                    routerId: broadcastId,
                });

                if (!broadcast) {
                    throw new Error("BROADCAST_NOT_FOUND");
                }

                if (broadcast.timeBook.endedAt == null) {
                    const router = await nativeDB.get("routers", broadcastId);
                    if (!router) {
                        throw new Error("BROADCAST_NOT_FOUND");
                    }
                    // send success response
                    callback({
                        kind: "success",
                        data: {
                            broadcastId: broadcast.routerId,
                            timeBook: broadcast.timeBook,
                            status: broadcast.status,
                            createdAt: broadcast.createdAt,
                            updatedAt: broadcast.updatedAt,
                        },
                    });
                } else {
                    // send success response
                    callback({
                        kind: "success",
                        data: {
                            broadcastId: broadcast.routerId,
                            timeBook: broadcast.timeBook,
                            status: broadcast.status,
                            createdAt: broadcast.createdAt,
                            updatedAt: broadcast.updatedAt,
                        },
                    });
                }
            } catch (error) {
                console.log(error);
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });

        // initiate a new live broadcast
        socket.on("initiateBroadcast", async (payload, callback = () => {}) => {
            try {
                const { originId, localData } = payload;

                const router = await worker.createRouter(
                    mediasoupOptions.router
                );

                const meta = {
                    transmission: {
                        worker: worker.pid,
                    },
                    originId: originId,
                    localData: localData,
                };

                const broadcast = new Broadcast({
                    routerId: router.id,
                    meta,
                    timeBook: {
                        startedAt: new Date(),
                        endedAt: null,
                    },
                    status: "On Air",
                });
                const newBroadcast = await broadcast.save();

                if (
                    (await nativeDB.set("routers", router.id, router)) &&
                    (await nativeDB.set("broadcasts", router.id, newBroadcast))
                ) {
                    callback({
                        kind: "success",
                        data: {
                            broadcast: {
                                broadcastId: router.id,
                                meta: newBroadcast.meta,
                                timeBook: newBroadcast.timeBook,
                                status: newBroadcast.status,
                            },
                        },
                    });
                } else {
                    // if the broadcast is not set in the ndb, then it is not set in the database
                    throw new Error("BROADCAST_INITIATION_FAILED");
                }
            } catch (error) {
                console.log(error);
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });

        // get router rtpCaps
        socket.on("routerRtpCaps", async (payload, callback = () => {}) => {
            try {
                const { originId, broadcastId } = payload;

                console.log("Router Rtp Caps", payload.broadcastId);

                const router = await nativeDB.get("routers", broadcastId);
                console.log(router);

                console.log(router.rtpCapabilities);

                if (router) {
                    callback({
                        kind: "success",
                        data: {
                            rtpCapabilities: router.rtpCapabilities,
                        },
                    });
                } else {
                    // if the broadcast is not set in the ndb, then it is not set in the database
                    throw new Error("ROUTER_RTPCAPS_FAILED");
                }
            } catch (error) {
                console.log(error);
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });

        // new publisher
        socket.on("broadcastPublish", async (payload, callback = () => {}) => {
            // AKA creating transport
            try {
                const { originId, broadcastId, localData } = payload;
                const router = await nativeDB.get("routers", broadcastId);
                if (!router) {
                    throw new Error("ROUTER_NOT_FOUND_BP");
                }
                const webRtcTransport = await router.createWebRtcTransport({
                    listenIps: mediasoupOptions.webRtcTransport.listenIps, // Set up listening IP and port
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                    appData: {
                        broadcastId: broadcastId,
                        originId: originId,
                        createdAt: new Date(),
                    },
                });

                const publisher = new Publisher({
                    broadcastId: broadcastId,
                    transportId: webRtcTransport.id,
                    meta: {
                        transmission: {
                            worker: worker.pid,
                            router: router.id,
                        },
                        originId: originId,
                        localData: localData,
                    },
                    timeBook: {
                        startedAt: new Date(),
                        endedAt: null,
                    },
                });

                // save the publisher in the database
                const newPublisher = await publisher.save();

                // set the publisher in the nativeDB
                await nativeDB.set(
                    "publishers",
                    webRtcTransport.id,
                    webRtcTransport
                );

                // send the publisher to the client
                callback({
                    kind: "success",
                    data: {
                        publisher: newPublisher,
                        transportOptions: {
                            id: webRtcTransport.id,
                            iceParameters: webRtcTransport.iceParameters,
                            iceCandidates: webRtcTransport.iceCandidates,
                            dtlsParameters: webRtcTransport.dtlsParameters,
                        },
                    },
                });
            } catch (error) {
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });

        // join broadcast
        socket.on("joinBroadcast", async (payload, callback = () => {}) => {
            try {
                console.log("JOIN BROADCAST");
                console.log(payload);

                const { originId, broadcastId, localData } = payload;

                const broadcast = await Broadcast.findOne({
                    routerId: broadcastId,
                    "timeBook.endedAt": null,
                    status: "On Air",
                });

                if (!broadcast) {
                    throw new Error("BROADCAST_NOT_FOUND");
                }

                const publishers = await Publisher.find({
                    broadcastId: broadcastId,
                    "timeBook.endedAt": null,
                });

                console.log("publishers");
                console.log(publishers);

                const producers = await Producer.find({
                    broadcastId: broadcastId,
                    "timeBook.endedAt": null,
                });

                console.log("producers");
                console.log(producers);

                console.log("Hitting router with broadcast id " + broadcastId);
                const router = await nativeDB.get("routers", broadcastId);

                const data = {
                    broadcastId: broadcastId,
                    rtpCapabilities: router.rtpCapabilities,
                    publishers: publishers,
                    producers: producers,
                };

                /* console.log("Response Data");
        console.log(data); */

                if (router) {
                    callback({
                        kind: "success",
                        data: data,
                    });
                } else {
                    // if the broadcast is not set in the ndb, then it is not set in the database
                    throw new Error("BROADCAST_NOT_FOUND");
                }
            } catch (error) {
                console.log(error);
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });

        // send tranfport on connect
        socket.on("transport-connect", async (payload, callback = () => {}) => {
            try {
                const { originId, broadcastId, transportId, dtlsParameters } =
                    payload;
                const broadcast = await Broadcast.findOne({
                    routerId: broadcastId,
                    "timeBook.endedAt": null,
                    status: "On Air",
                });

                if (!broadcast) {
                    throw new Error("BROADCAST_NOT_FOUND");
                }

                const publisher = await Publisher.findOne({
                    broadcastId: broadcastId,
                    transportId: transportId,
                });

                if (!publisher) {
                    throw new Error("PUBLISHER_NOT_FOUND");
                }

                const transport = await nativeDB.get("publishers", transportId);

                if (!transport) {
                    callback({
                        kind: "error",
                        error: "TRANSPORT_NOT_FOUND",
                    });
                }
                await transport.connect({ dtlsParameters });
                callback({
                    kind: "success",
                    data: {
                        transport: transport,
                    },
                });
            } catch (error) {
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });

        // send transport on produce
        socket.on("transport-produce", async (payload, callback = () => {}) => {
            try {
                const {
                    originId,
                    broadcastId,
                    transportId,
                    rtpParameters,
                    kind,
                    localData,
                } = payload;
                const transport = await nativeDB.get("publishers", transportId);
                if (!transport) {
                    callback({
                        kind: "error",
                        error: "TRANSPORT_NOT_FOUND",
                    });
                }
                const webRtcProducer = await transport.produce({
                    kind,
                    rtpParameters,
                });

                console.log("WEB_RTC_PRODUCER", webRtcProducer);

                const producer = new Producer({
                    broadcastId: broadcastId,
                    transportId: transport.id,
                    producerId: webRtcProducer.id,
                    kind: kind,
                    rtpParamters: rtpParameters,
                    meta: {
                        transmission: {
                            worker: worker.pid,
                            router: broadcastId,
                        },
                        originId: originId,
                        localData: localData,
                    },
                    timeBook: {
                        startedAt: new Date(),
                        endedAt: null,
                    },
                });
                await producer.save();
                // set the producer in the nativeDB
                await nativeDB.set(
                    "producers",
                    webRtcProducer.id,
                    webRtcProducer
                );
                p = p + 1;
                console.warn("PRODUCING_:", p);
                socket.emit(`new-producer-${broadcastId}`, {
                    producer,
                });

                callback({
                    kind: "success",
                    data: {
                        transport: transport,
                        producer: producer,
                        id: webRtcProducer.id,
                    },
                });
            } catch (error) {
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });
        // list of broadcast publishers
        socket.on(
            "broadcastPublishers",
            async (payload, callback = () => {}) => {
                try {
                    const { originId, broadcastId } = payload;

                    const publishers = await Publisher.find({
                        broadcastId: broadcastId,
                        "timeBook.endedAt": null,
                    });

                    const result = [];

                    for (let i = 0; i < publishers.length; i++) {
                        const thisPublisher = {};
                        thisPublisher.publisher = publishers[i];
                        thisPublisher.producers = await Producer.find({
                            transportId: publishers[i].transportId,
                        });

                        result.push(thisPublisher);
                    }

                    callback({
                        kind: "success",
                        data: {
                            publishers: result,
                        },
                    });
                } catch (error) {
                    callback({
                        kind: "error",
                        error: error.message,
                    });
                    console.log("broadcast-subscribe");
                    console.log(error);
                }
            }
        );
        // list of broadcast producers
        socket.on(
            "broadcastProducers",
            async (payload, callback = () => {}) => {
                try {
                    const { originId, broadcastId } = payload;

                    const producers = await Producer.find({
                        broadcastId: broadcastId,
                        "timeBook.endedAt": null,
                    });

                    callback({
                        kind: "success",
                        data: {
                            producers: producers,
                        },
                    });
                } catch (error) {
                    callback({
                        kind: "error",
                        error: error.message,
                    });
                    console.log("broadcast-subscribe");
                    console.log(error);
                }
            }
        );
        // subscribe to the broadcast
        socket.on(
            "broadcastSubscribe",
            async (payload, callback = () => {}) => {
                // AKA creating transport
                try {
                    const { originId, broadcastId, localData } = payload;
                    const router = await nativeDB.get("routers", broadcastId);
                    if (!router) {
                        throw new Error("BROADCAST_NOT_FOUND");
                    }

                    const subscriber = new Subscriber({
                        broadcastId: broadcastId,
                        subscriberId: uuidv4(),
                        meta: {
                            transmission: {
                                worker: worker.pid,
                                router: router.id,
                            },
                            originId: originId,
                            localData: localData,
                        },
                        timeBook: {
                            startedAt: new Date(),
                            endedAt: null,
                        },
                    });

                    // save the publisher in the database
                    const newSubscriber = await subscriber.save();

                    // set the publisher in the nativeDB
                    await nativeDB.set(
                        "subscribers",
                        newSubscriber.subscriberId,
                        newSubscriber
                    );

                    // send the publisher to the client
                    callback({
                        kind: "success",
                        data: {
                            subscriber: newSubscriber,
                        },
                    });
                } catch (error) {
                    callback({
                        kind: "error",
                        error: error.message,
                    });
                }
            }
        );
        // recv transport upon subscribe
        socket.on("broadcastConsume", async (payload, callback = () => {}) => {
            // AKA creating transport
            try {
                const { originId, broadcastId, localData, subscriberId } =
                    payload;
                const router = await nativeDB.get("routers", broadcastId);
                console.log(" :::::::::::::::::: ::::::::::::::::::: ");
                console.log("Broadcast ID is: " + broadcastId);
                console.log("ROUTER IS @ -> " + new Date().toISOString());
                console.log(router);
                console.log(" :::::::::::::::::: ::::::::::::::::::: ");
                if (!router) {
                    throw new Error("ROUTER_NOT_FOUND");
                }
                const webRtcTransport = await router.createWebRtcTransport({
                    listenIps: mediasoupOptions.webRtcTransport.listenIps, // Set up listening IP and port
                    enableUdp: true,
                    enableTcp: true,
                    preferUdp: true,
                    appData: {
                        broadcastId: broadcastId,
                        originId: originId,
                        createdAt: new Date(),
                    },
                });

                const consumer = new Consumer({
                    broadcastId: broadcastId,
                    transportId: webRtcTransport.id,
                    subscriberId: subscriberId,
                    meta: {
                        transmission: {
                            worker: worker.pid,
                            router: router.id,
                        },
                        originId: originId,
                        localData: localData,
                    },
                    timeBook: {
                        startedAt: new Date(),
                        endedAt: null,
                    },
                });

                // save the publisher in the database
                const newConsumer = await consumer.save();

                // set the recvTransport in the nativeDB
                await nativeDB.set(
                    "recvTransports",
                    webRtcTransport.id,
                    webRtcTransport
                );

                // send the publisher to the client
                callback({
                    kind: "success",
                    data: {
                        consumer: newConsumer,
                        transportOptions: {
                            id: webRtcTransport.id,
                            iceParameters: webRtcTransport.iceParameters,
                            iceCandidates: webRtcTransport.iceCandidates,
                            dtlsParameters: webRtcTransport.dtlsParameters,
                        },
                    },
                });
            } catch (error) {
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });
        // recv transport on connect
        socket.on(
            "transport-recv-connect",
            async (payload, callback = () => {}) => {
                try {
                    console.log("transport-recv-connect");
                    const {
                        originId,
                        broadcastId,
                        transportId,
                        dtlsParameters,
                    } = payload;
                    const broadcast = await Broadcast.findOne({
                        routerId: broadcastId,
                        "timeBook.endedAt": null,
                        status: "On Air",
                    });

                    if (!broadcast) {
                        throw new Error("BROADCAST_NOT_FOUND");
                    }

                    const consumer = await Consumer.findOne({
                        broadcastId: broadcastId,
                        transportId: transportId,
                    });

                    if (!consumer) {
                        throw new Error("CONSUMER_NOT_FOUND");
                    }

                    const transport = await nativeDB.get(
                        "recvTransports",
                        transportId
                    );

                    if (!transport) {
                        callback({
                            kind: "error",
                            error: "CONSUMER_TRANSPORT_NOT_FOUND",
                        });
                    }
                    await transport.connect({ dtlsParameters });
                    callback({
                        kind: "success",
                        data: {
                            transport: transport,
                        },
                    });
                } catch (error) {
                    callback({
                        kind: "error",
                        error: error.message,
                    });
                }
            }
        );
        // recv transport on consume
        socket.on(
            "transport-recv-consume",
            async (payload, callback = () => {}) => {
                try {
                    console.log("transport-recv-consume");
                    const {
                        originId,
                        broadcastId,
                        transportId,
                        producerId,
                        rtpCapabilities,
                    } = payload;
                    const broadcast = await Broadcast.findOne({
                        routerId: broadcastId,
                        "timeBook.endedAt": null,
                        status: "On Air",
                    });

                    if (!broadcast) {
                        throw new Error("BROADCAST_NOT_FOUND");
                    }

                    const consumer = await Consumer.findOne({
                        broadcastId: broadcastId,
                        transportId: transportId,
                    });

                    if (!consumer) {
                        throw new Error("CONSUMER_NOT_FOUND");
                    }

                    const transport = await nativeDB.get(
                        "recvTransports",
                        transportId
                    );

                    if (!transport) {
                        callback({
                            kind: "error",
                            error: "CONSUMER_TRANSPORT_NOT_FOUND",
                        });
                    }

                    const router = await nativeDB.get("routers", broadcastId);
                    if (!router) {
                        callback({
                            kind: "error",
                            error: "ROUTER_NOT_FOUND",
                        });
                    }

                    if (
                        router.canConsume({
                            producerId: producerId,
                            rtpCapabilities,
                        })
                    ) {
                        let consumer = await transport.consume({
                            producerId,
                            rtpCapabilities,
                            paused: true, // recommended
                        });
                        // set the recvTransport in the nativeDB
                        await nativeDB.set("consumers", consumer.id, consumer);

                        // update consumerId in database
                        await Consumer.findOneAndUpdate(
                            {
                                transportId: transportId,
                            },
                            {
                                consumerId: consumer.id,
                            }
                        );

                        // define consumer events
                        consumer.on("transportclose", () => {
                            console.log(
                                "To Do : transport is closed from consumer..."
                            );
                        });

                        consumer.on("producerclose", () => {
                            console.log(
                                "To Do : producer is closed so reload producers in client..."
                            );
                        });

                        callback({
                            kind: "success",
                            data: {
                                id: consumer.id,
                                producerId: producerId,
                                kind: consumer.kind,
                                rtpParameters: consumer.rtpParameters,
                            },
                        });
                    } else {
                        callback({
                            kind: "error",
                            error: "ROUTER_CAN_NOT_CONSUME_EXPLICITLY",
                        });
                    }
                } catch (error) {
                    callback({
                        kind: "error",
                        error: error.message,
                    });
                }
            }
        );
        // recv transport on consume resume
        socket.on(
            "transport-recv-consume-resume",
            async (payload, callback = () => {}) => {
                try {
                    const { originId, broadcastId, consumerId } = payload;

                    const consumer = await nativeDB.get(
                        "consumers",
                        consumerId
                    );

                    if (!consumer) {
                        callback({
                            kind: "error",
                            error: "CONSUMER_TRANSPORT_NOT_FOUND",
                        });
                    }

                    await consumer.resume();

                    callback({
                        kind: "success",
                        data: {
                            originId,
                            broadcastId,
                            consumerId,
                        },
                    });
                } catch (error) {
                    callback({
                        kind: "error",
                        error: error.message,
                    });
                }
            }
        );
        // recv transport upon subscribe
        socket.on("theEnd", async (payload, callback = () => {}) => {
            // The End
            console.log("The End Called");
            console.log(payload);
            try {
                const { originId, broadcastId, localData } = payload;
                const updateLog = {
                    subscribers: {
                        found: 0,
                        killed: 0,
                    },
                    consumers: {
                        found: 0,
                        killed: 0,
                    },
                    publishers: {
                        found: 0,
                        killed: 0,
                    },
                    producers: {
                        found: 0,
                        killed: 0,
                    },
                    broadcast: false,
                };
                // get all subscribers & update everything
                const subscribers = await Subscriber.find({
                    broadcastId: broadcastId,
                });

                updateLog.subscribers.found = subscribers.length;

                subscribers.forEach(async function (subscriber) {
                    // update model
                    const updated = await Subscriber.findOneAndUpdate(
                        {
                            _id: subscriber._id,
                        },
                        {
                            $set: {
                                "timeBook.endedAt": new Date(),
                            },
                        }
                    );

                    if (updated) {
                        // kill from ndb
                        await nativeDB.set(
                            "subscribers",
                            subscriber.subscriberId,
                            null
                        );
                        updateLog.subscribers.killed =
                            updateLog.subscribers.killed + 1;
                    }
                });

                // get consumers of this broadcast
                const consumers = await Consumer.find({
                    broadcastId: broadcastId,
                });
                updateLog.consumers.found = consumers.length;
                consumers.forEach(async function (consumer) {
                    // update model
                    const updated = await Consumer.findOneAndUpdate(
                        {
                            _id: consumer._id,
                        },
                        {
                            $set: {
                                "timeBook.endedAt": new Date(),
                            },
                        }
                    );

                    if (updated) {
                        // kill from ndb
                        await nativeDB.set(
                            "recvTransports",
                            consumer.transportId,
                            null
                        );
                        updateLog.consumers.killed =
                            updateLog.consumers.killed + 1;
                    }
                });

                // get publishers of this broadcast
                const publishers = await Publisher.find({
                    broadcastId: broadcastId,
                });
                updateLog.publishers.found = publishers.length;
                publishers.forEach(async function (publisher) {
                    // update model
                    const updated = await Publisher.findOneAndUpdate(
                        {
                            _id: publisher._id,
                        },
                        {
                            $set: {
                                "timeBook.endedAt": new Date(),
                            },
                        }
                    );

                    if (updated) {
                        // kill from ndb
                        await nativeDB.set(
                            "publishers",
                            publisher.transportId,
                            null
                        );
                        updateLog.publishers.killed =
                            updateLog.publishers.killed + 1;
                    }
                });

                // get publishers of this broadcast
                const producers = await Producer.find({
                    broadcastId: broadcastId,
                });
                updateLog.producers.found = producers.length;
                producers.forEach(async function (producer) {
                    // update model
                    const updated = await Producer.findOneAndUpdate(
                        {
                            _id: producer._id,
                        },
                        {
                            $set: {
                                "timeBook.endedAt": new Date(),
                            },
                        }
                    );

                    if (updated) {
                        // kill from ndb
                        await nativeDB.set(
                            "producers",
                            producer.producerId,
                            null
                        );
                        updateLog.producers.killed =
                            updateLog.producers.killed + 1;
                    }
                });

                // kill broadcast
                const broadcastUpdated = await Broadcast.findOneAndUpdate(
                    {
                        routerId: broadcastId,
                    },
                    {
                        $set: {
                            "timeBook.endedAt": new Date(),
                            status: "Ended",
                        },
                    }
                );

                if (broadcastUpdated) {
                    const router = await nativeDB.get("routers", broadcastId);
                    // Close all transports associated with the router
                    // for (const transport of router.transports) {
                    //     transport.close();
                    // }

                    // // Close all producers associated with the router
                    // for (const producer of router.producers) {
                    //     producer.close();
                    // }

                    // // Close all consumers associated with the router
                    // for (const consumer of router.consumers) {
                    //     consumer.close();
                    // }

                    // // Close all RTP observers associated with the router
                    // for (const observer of router.rtpObservers) {
                    //     observer.close();
                    // }

                    // // Close all RTP streams associated with the router
                    // for (const stream of router.rtpStreams) {
                    //     stream.close();
                    // }

                    // Finally, close the router itself
                    router.close();

                    await nativeDB.set("routers", broadcastId, null);
                    await nativeDB.set("broadcasts", broadcastId, null);

                    updateLog.broadcast = true;
                }

                const broadcast = await Broadcast.findOne({
                    routerId: broadcastId,
                });

                callback({
                    kind: "success",
                    data: {
                        updateLog,
                        broadcast: broadcast,
                    },
                });
            } catch (error) {
                callback({
                    kind: "error",
                    error: error.message,
                });
            }
        });

        socket.on("disconnect", () => {
            console.log("Client disconnected");
        });
    });
})();
