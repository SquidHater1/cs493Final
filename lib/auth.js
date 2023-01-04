const jwt = require('jsonwebtoken')
const { getCourseById } = require('../models/course')
const { getUserById } = require('../models/user')

const secretKey = 'SuperSecret'//secret key used for authentication
exports.secretKey = secretKey

//function generates an authentication for a user
function generateAuthToken(userID) {
    console.log("== Generating authentication token for user: ", userID)
    const payload = { sub: userID }
    return jwt.sign(payload, secretKey, {expiresIn: '24h' })//token expires in 24h
}
exports.generateAuthToken = generateAuthToken


//function to be called when an api endpoint requires authentication
function requireAuthentication(req, res, next) {
    const authHeader = req.get('Authorization') || ''
    const authHeaderParts = authHeader.split(' ')

    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null//If the first part of the header is 'Bearer', the next part is the token, otherwise null

    try {
        const payload = jwt.verify(token, secretKey)//verifies that the token is valid
        req.user = payload.sub//returns the userID of the authentication token
        next()
    } catch (err) {
        res.status(401).json({
            error: "Invalid authentication token provided."
        })
    }
}
exports.requireAuthentication = requireAuthentication

async function requireAdmin(req, res, next){
    const authHeader = req.get('Authorization') || ''
    const authHeaderParts = authHeader.split(' ')

    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null//If the first part of the header is 'Bearer', the next part is the token, otherwise null

    try {
        const payload = jwt.verify(token, secretKey)//verifies that the token is valid
        req.user = payload.sub//returns the userID of the authentication token
        thisUser = await getUserById(req.user)
        if(thisUser.role === "admin"){
            next()
        }else{
            res.status(403).json({
                error: "Incorrect permissions to access this resource"
            })
        }
    } catch (err) {
        res.status(401).json({
            error: "Invalid authentication token provided."
        })
    }
}
exports.requireAdmin = requireAdmin

async function requireStudent(req, res, next){
    const authHeader = req.get('Authorization') || ''
    const authHeaderParts = authHeader.split(' ')

    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null
    try {
        const payload = jwt.verify(token, secretKey)
        req.user = payload.sub
        thisUser = await getUserById(req.user)
        if(thisUser.role === "student"){
            next()
        }else{
            res.status(403).json({
                error: "Incorrect permissions to access this resource"
            })
        }
    } catch (err) {
        res.status(401).json({
            error: "Invalid authentication token provided."
        })
    }
}
exports.requireStudent = requireStudent

async function courseAuthentication(req,res,next){
    const authHeader = req.get('Authorization') || ''
    const authHeaderParts = authHeader.split(' ')

    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null//If the first part of the header is 'Bearer', the next part is the token, otherwise null

    try {
        const payload = jwt.verify(token, secretKey)//verifies that the token is valid
        req.user = payload.sub//returns the userID of the authentication token
        thisUser = await getUserById(req.user)
        thisCourse = await getCourseById(req.params.id)
        if(thisCourse){
            if(thisUser.role === "admin" || (thisUser.role === "instructor" && thisCourse.instructorId === thisUser._id.toString())){//still need to add checks to make sure course instructor and this one match
                next()
            }else{
                res.status(403).json({
                    error: "Incorrect permissions to access this resource"
                })
            }
        }else{
            res.status(401).json({
                error: "No course specified for the given id"
            })
        }
    } catch (err) {
        console.error(err)
        res.status(401).json({
            error: "Invalid authentication token provided."
        })
    }
}
exports.courseAuthentication = courseAuthentication


async function courseAssignmentAuthentication(req,res,next){
    const authHeader = req.get('Authorization') || ''
    const authHeaderParts = authHeader.split(' ')

    const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null//If the first part of the header is 'Bearer', the next part is the token, otherwise null

    try {
        const payload = jwt.verify(token, secretKey)//verifies that the token is valid
        req.user = payload.sub//returns the userID of the authentication token
        thisUser = await getUserById(req.user)
        thisCourse = await getCourseById(req.body.courseId)
        if(thisCourse){
            if(thisUser.role === "admin" || (thisUser.role === "instructor" && thisCourse.instructorId === thisUser._id.toString())){//still need to add checks to make sure course instructor and this one match
                next()
            }else{
                res.status(403).json({
                    error: "Incorrect permissions to access this resource"
                })
            }
        }else{
            res.status(401).json({
                error: "No course specified for the given id"
            })
        }
    } catch (err) {
        console.error(err)
        res.status(401).json({
            error: "Invalid authentication token provided."
        })
    }
}
exports.courseAssignmentAuthentication = courseAssignmentAuthentication
