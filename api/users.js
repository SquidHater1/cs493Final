/*
 * API sub-router for users endpoints.
 */

const { Router } = require('express')
const { getUserByEmail, insertNewUser, UserSchema, getUserById, userHasAccess } = require('../models/user')
const bcrypt = require('bcryptjs')
const jwt = require('jsonwebtoken')
const { generateAuthToken, requireAuthentication, secretKey } = require('../lib/auth')
const { validateAgainstSchema } = require('../lib/validation')

const router = Router()


//add new user
router.post('/', async function (req, res) {
    try{
        if(req.body && validateAgainstSchema(req.body, UserSchema) && roleIsValid(req.body.role)){
            if(req.body.role === "admin" || req.body.role === "instructor"){//if the request is to create an administrator or instructor, then some authorization checks need to be done
                const authHeader = req.get('Authorization') || ''
                const authHeaderParts = authHeader.split(' ')

                const token = authHeaderParts[0] === 'Bearer' ? authHeaderParts[1] : null//get the auth token

                try {

                    const payload = jwt.verify(token, secretKey)
                    req.user = payload.sub//get the user id from the token
                    console.log("== Got payload.sub: ", req.user)

                    const isAdmin = await hasAdminAccess(req.user)//check if the userid from the token is an admin

                    console.log("== Checked if they are an admin")

                    if(isAdmin){//if they are an admin, they can create the admin user
                        if(await getUserByEmail(req.body.email)){
                            res.status(403).send({
                                error: "Email already in use"
                            })
                        }else{
                            const userId = await insertNewUser(req.body)
                            res.status(201).send({
                                id: userId
                            })
                        }
                    }else{//otherwise give an error
                        res.status(403).send({
                            error: "Only administrators can create other instructors and administrator accounts"
                        })
                    }

                }catch (err) {
                    res.status(400).send({
                        error: "Invalid authentication token provided"
                    })
                }

            }else{//Don't do authorization checks if they aren't trying to create an admin
                if(await getUserByEmail(req.body.email)){
                    res.status(403).send({
                        error: "Email already in use"
                    })
                }else{
                    const userId = await insertNewUser(req.body)
                    res.status(201).send({
                        id: userId
                    })
                }
            }

        }else{
            res.status(400).json({
                error: "Request body needs a name, email, password, and a valid role (student, instructor, or admin)"
            })
        }
    }catch (e){
        throw e
    }
})

async function hasAdminAccess(reqUser){
    const tempUser = await getUserById(reqUser, false)
    if(tempUser){
        const isAdmin = (tempUser.role === "admin")
        return isAdmin
    }else{
        return false
    }
    
}

function roleIsValid(role){
    if(role === "student" || role === "instructor" || role === "admin"){
        return true
    }else{
        return false
    }
}

//user login
router.post('/login', async function (req, res) {
    //make sure that the request body has an email and password
    if (req.body && req.body.email && req.body.password) {
        
        try {

            const thisUser = await getUserByEmail(req.body.email)
            if(thisUser){

                const userId = thisUser._id
                const authenticated = await bcrypt.compare(req.body.password, thisUser.password)
                if(authenticated){
                    const token = generateAuthToken(userId)
                    res.status(200).send({
                        id: userId,
                        token: token
                    })
                }else{
                    res.status(401).send({
                        error: "Invalid authentication credentials"
                    })
                }

            }else{
                res.status(401).send({
                    error: "Invalid authentication credentials"
                })
            }

        } catch (err) {
            res.status(500).send({
                error: "Error logging in. Please try again later."
            })
        }

    }else{
        res.status(400).json({
            error: "Request body needs email and password to login"
        })
    }
})

//get user by id
router.get('/:id', requireAuthentication, async function (req, res) {
    const hasAccess = await userHasAccess(req.user, req.params.id)

    //console.log("==req.user after authentication: ", req.user)
    //console.log("== req.params.id: ", req.params.id)
    //console.log("== result of hasAccess: ", hasAccess)

    if( !hasAccess ){
        res.status(403).json({
            error: "Unauthorized to access the specified resource"
        })
    } else {
        const userId = req.params.id
        try {
            const thisUser = await getUserById(userId, false)
            res.status(200).json({
                user: thisUser
            })
        }catch (err) {
            res.status(500).send({
                error: "Error logging in. Try again later."
            })
        }
    }
})

module.exports = router