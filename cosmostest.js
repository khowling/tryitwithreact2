const 
    url = require('url'),
    MongoClient = require('mongodb').MongoClient,
    MongoURL = process.env.MONGO_DB || "mongodb://localhost:27017/mydb01"


const initapp = async () => {

    const client = await MongoClient.connect(process.env.MONGO_DB, { useNewUrlParser: true })
    const dbname = url.parse(MongoURL).pathname.substr(1)
    const db = client.db(dbname)

    const coll = `${dbname}.test`
    console.log (`create shardColl ${coll}`)
    try {
        await db.command({ shardCollection: coll, key: { partition_key:  "hashed" }})
        
    } catch (err) {
        //console.log (err)
        //client.close();
        //return
    }
    try {
        await db.collection('test')
        console.log ("createIndex : expire after 'expires' date field")
        await db.collection('test').createIndex({"_ts":1}, {expireAfterSeconds: 60})
        console.log ("deleteMany")
        await db.collection('test').deleteMany({ partition_key: 0})
        console.log ("insertOne")
        await db.collection('test').insertOne ({partition_key: 0, name: "keith", ttl: 5})
        console.log ("find")
        for (let r of await db.collection('test').find({name:"keith"}).toArray()) {
            console.log (r)
        }
    } catch (err) { console.log (err)}
    

    client.close()
}

initapp()