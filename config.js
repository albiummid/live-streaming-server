const APP = {
    PORT: 5483,
    SOCKET_PATH: '/live.engine',
    REST_PATH: '/rest',
    MONGO: {
        HOST: '',
        PORT: '',
        DB: '',
        URL: 'mongodb://127.0.0.1:27017/live_engine_alpha'
    }
}


const BROKER = {
    BASE: 'http://127.0.0.1:5482',
    PATH: '/pdb'
}

module.exports = { 
    APP,
    BROKER
}