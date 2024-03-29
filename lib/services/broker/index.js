const config = require('../../../config');
const { v4: uuidv4 } = require('uuid');
const io = require('socket.io-client');

const socket = io(config.BROKER.BASE, {
    path: config.BROKER.PATH,
});




async function shoot(message) {

    return new Promise(function(resolve, reject) {
        socket.emit('query', message, (data) =>{
          resolve(data);
        });
        
    });

}


module.exports = {
    shoot
}

