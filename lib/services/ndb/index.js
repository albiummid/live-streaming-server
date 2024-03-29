// const broker = require('../broker');

async function set(table, key, value){
  // FIRST SET THE VALUE IN THE DATABASE
  if(!ndb[table]) ndb[table] = {};

  if(ndb[table][key]){
      delete ndb[table][key];
      ndb[table][key] = value;
      console.log('NDB Set :: Rewriten ✅');
      console.log({
        key,
        value
      });
  }
  else{
      ndb[table][key] = value;
      console.log('NDB Set :: New ✅');
      console.log({
        table,
        key,
        value
      });
  }

  // // THEN SET THE VALUE IN THE REMOTE DATABASE
  // const data = await broker.shoot({
  //     action: 'SET',
  //     query: {
  //         table: table,
  //         key: key,
  //         value: value
  //     }
  // })
  
  // if(data.kind === 'success'){
  //   console.log(`RDB Set :: ${data.ops} ✅`);
  //   console.log(`============================================`);
  //   return true;
  // }
  // console.log(`RDB Set :: ${data.error} ❌`);
  // console.log(`============================================`);


  // return false;
  
  // new line 
  return true
}

async function get(table, key){
  console.log(`🏆🏆🏆🏆🏆🏆🏆🏆`);
  console.log(table, "=>" ,key);
  if(ndb[table][key]){
    console.log("In Local DB");
    console.log(`Get :: NDB ✅`);
    return ndb[table][key];
  }
  // else{
  //   console.log("In Remote DB");
  //   // THEN GET THE VALUE FROM THE REMOTE DATABASE
  //   const data = await broker.shoot({
  //       action: 'GET',
  //       query: {
  //           table: table,
  //           key: key
  //       }
  //   })

  //   if(data.kind === 'success'){
  //     console.log(`GET :: RDB ✅`);
  //     return data.value;
  //   }
  //   console.log(`GET :: RDB :: FAILED ❌`);
  //   return null;
  // }

  return null
         
}

async function discard(table, key){
    
        // FIRST DISCARD THE VALUE IN THE DATABASE
        if(ndb[table][key]){
            delete ndb[table][key];
        }
    
        // // THEN DISCARD THE VALUE IN THE REMOTE DATABASE
        // const data = await broker.shoot({
        //     action: 'DISCARD',
        //     query: {
        //         table: table,
        //         key: key
        //     }
        // })
    
        // if(data.kind === 'success'){
        //     return true;
        // }
    
        // return false;

        // new line
        return true
}

module.exports = {
    set,
    get,
    discard
}
