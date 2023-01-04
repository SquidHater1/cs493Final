const express = require('express')
const morgan = require('morgan')
const redis = require('redis')

const api = require('./api')
const jwt = require('jsonwebtoken')
const { secretKey } = require('./lib/auth')
const { connectToDb, getDbReference } = require('./lib/mongo')//lets api server connect to mongodb
const { getUserById } = require('./models/user')

const app = express()
const port = process.env.PORT || 8000//port of the api
const redisHost = process.env.REDIS_HOST
const redisPort = process.env.REDIS_PORT || '6379'

const redisClient = redis.createClient({
    url: `redis://${redisHost}:${redisPort}`
})

const rateLimitWindowMillisconds = 60000
const rateLimitWindowMaxRequests = 10
const rateLimitWindowAuthMax = 30

async function rateLimit(req, res, next) {

    const authHeader = req.get('Authorization') || ''
    const authHeaderParts = authHeader.split(' ')

    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null
    try {
        if(token){
            const payload = jwt.verify(token, secretKey)
            const userId = payload.sub

            //console.log("== Got userId: ", userId)
            const thisUser = await getUserById(userId, false)
            if(thisUser){
                //console.log("== Confirmed user exists: ", thisUser)
                let tokenBucket = await redisClient.hGetAll(userId)
                tokenBucket = {
                    tokens: parseFloat(tokenBucket.tokens) || rateLimitWindowAuthMax,
                    last: parseInt(tokenBucket.last) || Date.now()
                }

                const timestamp = Date.now()
                const elapsedMilliseconds = timestamp - tokenBucket.last
                const refreshRate = rateLimitWindowAuthMax / rateLimitWindowMillisconds
                tokenBucket.tokens += elapsedMilliseconds * refreshRate
                tokenBucket.tokens = Math.min(rateLimitWindowAuthMax, tokenBucket.tokens)
                tokenBucket.last = timestamp

                if(tokenBucket.tokens >= 1) {
                    tokenBucket.tokens -= 1
                    //console.log("==remaining tokens for authenticated user: ", tokenBucket.tokens.toString())
                    await redisClient.hSet(userId, [
                        ['tokens', tokenBucket.tokens],
                        ['last', tokenBucket.last]
                    ])
                    next()
                }else{
                    res.status(429).json({
                        error: "Too many requests per minute, authenticated users get 30 requests per minute"
                    })
                }
            }else{
                //console.log("== invalid token provided")
                res.status(401).send({
                    error: "Invalid authentication token provided"
                })
            }

        }else{
            //console.log("== no token provided, using ip")
            let tokenBucket = await redisClient.hGetAll(req.ip)
            tokenBucket = {
                tokens: parseFloat(tokenBucket.tokens) || rateLimitWindowMaxRequests,
                last: parseInt(tokenBucket.last) || Date.now()
            }
            const timestamp = Date.now()
            const elapsedMilliseconds = timestamp - tokenBucket.last
            const refreshRate = rateLimitWindowMaxRequests / rateLimitWindowMillisconds
            tokenBucket.tokens += elapsedMilliseconds * refreshRate
            tokenBucket.tokens = Math.min(rateLimitWindowMaxRequests, tokenBucket.tokens)
            tokenBucket.last = timestamp

            if(tokenBucket.tokens >= 1) {
                tokenBucket.tokens -= 1
                await redisClient.hSet(req.ip, [
                    ['tokens', tokenBucket.tokens],
                    ['last', tokenBucket.last]
                ])
                next()
            }else{
                await redisClient.hSet(req.ip, [
                    ['tokens', tokenBucket.tokens],
                    ['last', tokenBucket.last]
                ])
                res.status(429).json({
                    error: "Too many requests per minute, non-authenticated users get 10 requests per minute"
                })
            }
        }
    } catch (err){
        console.error(err)
        next()
        return
    }


}



app.use(morgan('dev'))//set up morgan logger

app.use(express.json())
app.use(express.static('public'))

app.use(rateLimit)

app.use('/', api)//checks all routes in the /api directory for different requests


//If nothing is found in the other requests, default to an error 404
app.use('*', function (req, res, next) {
    res.status(404).json({
        error: "Requested resource " + req.originalUrl + " does not exist"
    })
})

//handle errors
app.use('*', function (err, req, res, next){
    console.error("== Error: ", err)
    res.status(500).send({
        error: "Server error. Please try again later."
    })
})

//Connect to mongodb, calls the function in ./lib/mongo
connectToDb( function () {
    redisClient.connect().then(function () {
        app.listen(port, function () {
            console.log("== Server is running on port", port)
        })
    })
})
