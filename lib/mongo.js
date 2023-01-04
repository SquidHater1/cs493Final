const { MongoClient } = require('mongodb')

//List of environment variables that mongodb will pull from for use
const mongoHost = process.env.MONGO_HOST || 'localhost'
const mongoPort = process.env.MONGO_PORT || 27017
const mongoUser = process.env.MONGO_USER
const mongoPassword = process.env.MONGO_PASSWORD
const mongoDbName = process.env.MONGO_DB_NAME
const mongoAuthDbName = process.env.MONGO_AUTH_DB_NAME || mongoDbName

//creates the url to connect to mongodb
const mongoUrl = `mongodb://${mongoUser}:${mongoPassword}@${mongoHost}:${mongoPort}/${mongoAuthDbName}`

let db = null
let _closeDbConnection = null

exports.connectToDb = function (callback) {
  //connects to Mongodb using url and other environment variables
  MongoClient.connect(mongoUrl, function (err, client) {
    if (err) {
      throw err
    }
    db = client.db(mongoDbName)
    _closeDbConnection = function () {
      client.close()
    }
    callback()
  })
}

//returns a reference to the db
exports.getDbReference = function () {
  return db
}

exports.closeDbConnection = function (callback) {
  _closeDbConnection(callback)
}