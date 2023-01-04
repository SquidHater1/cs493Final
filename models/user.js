const { ObjectId } = require('mongodb')
const bcrypt = require('bcryptjs')

const { getDbReference } = require('../lib/mongo')
const { extractValidFields } = require('../lib/validation')

//Schema describing requires/optional fields of a user object
const UserSchema = {
    name: { required: true },
    email: { required: true },
    password: { required: true },
    role: { required: true }
}
exports.UserSchema = UserSchema

async function insertNewUser(user) {
    user = extractValidFields(user, UserSchema)
    user.password = bcrypt.hashSync(user.password, 8)
    const db = getDbReference()
    const collection = db.collection('users')
    const result = await collection.insertOne(user)
    return result.insertedId
}
exports.insertNewUser = insertNewUser

async function getUserByEmail(email) {
    const db = getDbReference()
    const collection = db.collection('users')
    const result = await collection.find({email: email}).toArray()
    if(result){
        return result[0]
    }else{
        return null
    }
}
exports.getUserByEmail = getUserByEmail

async function getUserById(userId, includePassword){
    const db = getDbReference()
    const collection = db.collection('users')
    userId = new ObjectId(userId)
    const result = await collection.find({_id: userId}).toArray()
    //console.log("==Checking for user with id: ", userId)
    //console.log("== got result: ", result[0])
    if(result[0]){
        if(includePassword){
            const thisUser = result[0]
            return thisUser
        }else{
            const thisUser = {
                _id: result[0]._id,
                name: result[0].name,
                email: result[0].email,
                role: result[0].role
            }
            return thisUser
        }
    }else{
        return null
    }
    
}
exports.getUserById = getUserById

async function userHasAccess(userId, targetId){
    const tempUser = await getUserById(userId, false)
    if(tempUser){
        const isAdmin = tempUser.role === "admin" ? true : false
        return (userId == targetId || isAdmin)
    }else{
        return false
    }
}
exports.userHasAccess = userHasAccess