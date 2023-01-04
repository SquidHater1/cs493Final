const { ObjectId, GridFSBucket } = require('mongodb')
const { get } = require('../api/assignments')

const { getDbReference } = require('../lib/mongo')
const { extractValidFields } = require('../lib/validation')
const { getUserById } = require('./user')
const multer = require('multer')
const fs = require('fs')

const AssignmentSchema = {
    courseId: { required: true },
    title: { required: true },
    points: { required: true },
    due: { required: true }
}
exports.AssignmentSchema = AssignmentSchema

const SubmissionSchema = {
    assignmentId: { required: true },
    studentId: { required: true },
    timestamp: { required: true },
    grade: { required: true },
    file: { required: true }
}
exports.SubmissionSchema = SubmissionSchema

/*
 * Function to insert new assignment into the DB
 */
async function insertNewAssignment(body){
    assignment = extractValidFields(body, AssignmentSchema)
    assignment.submissions = []
    const db = getDbReference()
    const collection = db.collection('assignments')
    const result = await collection.insertOne(assignment)
    return result.insertedId
}
exports.insertNewAssignment = insertNewAssignment

/*
 * Function to get an assignment by id from the DB
 */
async function getAssignmentById(id){
    const db = getDbReference()
    const collection = db.collection('assignments')
    const result = await collection.find({
        _id: id
    }).toArray();
    return result[0]
}
exports.getAssignmentById = getAssignmentById

/*
 * Function to update an assignment by id in the DB
 */
async function updateAssignmentById(id, body){
    const db = getDbReference()
    const collection = db.collection('assignments')
    const assignmentValues = {
        courseId: body.courseId,
        title: body.title,
        points: body.points,
        due: body.due
    }
    const result = await collection.replaceOne(
        {_id: new ObjectId(id) },
        assignmentValues
    )
    return result.matchedCount > 0
}
exports.updateAssignmentById = updateAssignmentById


/*
 * Function to remove an assignment by id from the DB
 */
async function removeAssignmentById(id){
    const db = getDbReference()
    const collection = db.collection('assignments')
    const result = await collection.deleteOne({_id: new ObjectId(id)})
    /*
     TO-DO: remove all submissions for the assignment.
     probably by calling delte submissions by ID?
     */
    return result.deletedCount > 0
}
exports.removeAssignmentById = removeAssignmentById


/*
 * Function to fetch all submissions for an assignment
 */
async function getAssignmentSubmissions(id){
    const db = getDbReference()
    const collection = db.collection('assignments')
    const submissions = await collection.aggregate([
        { $match: { _id: new ObjectId(id) } },
        { $lookup: {
            from: "submissions",
            localField: "id",
            foreignField: "assignmentid",
            as: "submissions"
        }}
    ]).toArray()
    return submissions[0]
}
exports.getAssignmentById = getAssignmentSubmissions


/* 
 * Function to get Submissions page
 */
async function getSubmissionPage(page, sId){
    const db = getDbReference()
    const collection = db.collection('submissions')
    const count = await collection.countDocuments()

    /*
     * Compute last page number and make sure page is within allowed bounds.
     * Compute offset into collection.
     */
    const pageSize = 10
    const lastPage = Math.ceil(count / pageSize)
    page = page > lastPage ? lastPage : page
    page = page < 1 ? 1 : page
    const offset = (page - 1) * pageSize


    const results = await collection.find({ studentId: sId })
        .sort({ _id: 1 })
        .skip(offset)
        .limit(pageSize)
        .toArray()

    return {
        submissions: results,
        page: page,
        totalPages: lastPage,
        pageSize: pageSize,
        count: count
    }
}
exports.getSubmissionPage = getSubmissionPage


/* 
 * Function to upload file for a submission:
 */

async function insertNewSubmission(body){
    submission = extractValidFields(body, SubmissionSchema)
    const db = getDbReference()
    const collection = db.collection('submissions')
    const result = await collection.insertOne(submission)
    return result.insertedId
}
exports.insertNewSubmission = insertNewSubmission

/*
  Function to save a submission file to GridFSBucket for MongoDB
*/

async function saveSubmissionFile(file){
  return new Promise(function (resolve, reject) {

    const db = getDbReference()
    const bucket = new GridFSBucket(db, { bucketName: 'submissions' })

    const metadata = {
      studentId: file.studentId,
      assignmentId: file.assignmentId,
      mimetype: file.mimetype
    }

    const uploadStream = bucket.openUploadStream(file.filename, {
      metadata: metadata
    })

    fs.createReadStream(file.path).pipe(uploadStream)
      .on('error', function (err) {
        reject(err)
      })
      .on('finish', function (result) {
        console.log("== stream result:", result)
        resolve(result._id)
      })

  })
}
exports.saveSubmissionFile = saveSubmissionFile

async function deleteSubmissionByID(body){
  const db = getDbReference()
  const collection = db.collection('submissions')
  const success = await collection.deleteOne({_id: new ObjectId(body)})
  return success.deletedCount > 0
}
exports.deleteSubmissionByID = deleteSubmissionByID
