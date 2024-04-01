const mediasoupOptions = {
    worker: {
        rtcMinPort: 20000,
        rtcMaxPort: 50000,
        logLevel: "warn",
        logTags: ["info", "ice", "dtls", "rtp", "srtp", "rtcp"],
        rtcIPv4: true,
        rtcIPv6: false,
        /* dtlsCertificateFile: '/var/www/certs/certificate.pem',
    dtlsPrivateKeyFile: '/var/www/certs/privateKey.pem', */
    },
    router: {
        mediaCodecs: [
            {
                kind: "audio",
                mimeType: "audio/opus",
                clockRate: 48000,
                channels: 2,
            },
            {
                kind: "video",
                mimeType: "video/VP8",
                clockRate: 90000,
                parameters: {
                    "x-google-start-bitrate": 1000,
                },
            },
            {
                kind: "video",
                mimeType: "video/H264",
                clockRate: 90000,
                parameters: {
                    "packetization-mode": 1,
                },
            },
        ],
    },
    webRtcTransport: {
        listenIps: [{ ip: "0.0.0.0", announcedIp: "192.168.0.112" }],
    },
};

module.exports = mediasoupOptions;
