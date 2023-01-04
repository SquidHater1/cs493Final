/*
 * API sub-router for assignments endpoints.
 */

const { Router } = require('express')
const multer = require('multer')
const crypto = require('crypto')
const { requireAdmin, courseAssignmentAuthentication, requireAuthentication, requireStudent } = require('../lib/auth')
const { validateAgainstSchema } = require('../lib/validation')
const {
    insertNewAssignment,
    AssignmentSchema,
    getAssignmentById,
    updateAssignmentById,
    removeAssignmentById, 
    SubmissionSchema,
    getSubmissionPage,
    saveSubmissionFile,
    insertNewSubmission
} = require('../models/assignment')
const { getCourseById } = require('../models/course')
const { getUserById } = require('../models/user')


/*
  MIME File types for submission
*/
const fileTypes = {
  'text/plain': 'txt'
}

/*
  File uploading to store
  Stored in Submissions directory
*/
const upload = multer({
  storage: multer.diskStorage({
    destination: `${__dirname}/submissions`,
    filename: function (req,file,callback) {
      const ext = fileTypes[file.mimetype]
      const filename = crypto.pseudoRandomBytes(16).toString('hex')
      callback(null, `${filename}.${ext}`)
    }
  }),
  filefilter: function (req, file, callback) {
    callback(null, !!fileTypes[file.mimetype])
  }
})

const router = Router()

/*
 * Create and store a new Assignment with specified data in the DB
 * Only an authenticated 'instructor' matching the course instructorId
 * may create an assignment.
 */
router.post('/', courseAssignmentAuthentication, async function (req, res) {
    if(validateAgainstSchema(req.body, AssignmentSchema)) {
        try {
            const id = await insertNewAssignment(req.body)
            res.status(201).send({
                id: id
            })
        } catch (err) {
            console.error(err)
            res.status(500).send({
                error: "Error inserting assignment into DB. Please try again later."
            })
        }
    } else {
        res.status(400).send({
            error: "Request body is not a valid assignment object"
        })
    }
})


/*
 * Return summary data bout the Assignment, excluding the list of Submissions.
 */
router.get('/:id', async function (req, res) {
    try {
        const result = await getAssignmentById(req.params.id)
        if(result){
            const thisAssignment = {
                courseId: result.courseId,
                title: result.title, 
                points: result.points,
                due: result.due
            }
            res.status(200).json(assignment)
        }else{
            res.status(404).send({
                error: "No Assignments found for the specified id"
            })
        }
    }catch (err) {
        console.error(err)
        res.status(500).send({
            error: "Error getting assignment. Please try again later."
        })
    }
})


/*
 * Update data for a specific Assignment. Cannot modify submissions.
 * Only authenticated 'admin' or 'instructor' of course.instructorId can update.
 */
router.patch('/:id', requireAuthentication, async function (req, res) {
    if(validateAgainstSchema(req.body, AssignmentSchema)) {
        try {
            const user = await getUserById(req.user)
            const verify = await checkUser(user, req.params.id)
            if(verify){
                const success = await updateAssignmentById(req.params.id, req.body)
                if(success){
                    res.status(200).send()
                }
                else{
                    res.status(404).send({
                        error: "Specified Assignment " + req.params.id + " not found"
                    })
                }
            } else res.status(403).send({
                error: "The request was made by an unauthorized user."
            })
        } catch (err) {
            console.error(err)
            res.status(500).send({
                error: "Error inserting assignment into DB. Please try again later."
            })
        }
    } else {
        res.status(400).send({
            error: "Request body is not a valid assignment object"
        })
    }
})


/*
 * Remove a specific Assignment from the database, including submissions
 * Only authenticated 'admin' or 'instructor' of course.instructorId can delete.
 */
router.delete('/:id', requireAuthentication, async function (req, res){
    try {
        const user = await getUserById(req.user)
        console.log("got user: ", user)
        const verify = await checkUser(user, req.params.id)
        if(verify){
            console.log("verified user")
            const success = await removeAssignmentById(req.params.id)
            console.log("success: ", success)
            if(success){
                res.status(204).send()
            }
            else{
                res.status(404).send({
                    error: "Specified Assignment " + req.params.id + " not found"
                })
            }
        }else res.status(403).send({
            error: "The request was made by an unauthorized user."
        })
    } catch(err){
        console.error(err)
        res.status(500).send({
            error: "Error deleting assignment from DB. Please try again later."
        })
    }
})


/*
 * Fetch the list of all Submissions for an Assignment.
 * Only authenticated 'admin' or 'instructor' of course.instructorId
 */
router.get('/:id/submissions', requireAuthentication, async function(req, res){
    try {
        const user = await getUserById(req.user)
        console.log("got user: ", user)
        const verify = await checkUser(user, req.params.id)
        if(verify){
            const submissionPage = await getSubmissionPage(parseInt(req.query.page) || 1, req.query.studentId)
            submissionPage.links = {}
            if (submissionPage.page < submissionPage.totalPages) {
                submissionPage.links.nextPage = 
                `/assignments/${req.params.id}/submissions?page=${submissionPage.page + 1}`

                submissionPage.links.lastPage = 
                `/assignments/${req.params.id}/submissions?page=${submissionPage.totalPages}`
            }
            if (submissionPage.page > 1) {
                submissionPage.links.prevPage = 
                `/assignments/${req.params.id}/submissions?page=${submissionPage.page -1}`

                submissionPage.links.firstPage =
                `/assignments/${req.params.id}/submissions?page=1`
            }
            res.status(200).send(submissionPage)
        } else res.status(403).send({
            error: "The request was made by an unauthorized user."
        })
    } catch (err) {
        console.error(err)
        res.status(500).send({
            error: "Error fetching submission list. Please try agian later."
        })
    }
})

/*
 * Create a new submission for an assignment
 */
router.post('/:id/submissions', requireStudent, upload.single('file'), async function(req, res){
    console.log("== req.body:", req.body)
    console.log("== req.file:", req.file)


    if(req.body && req.file){

        const submission = {
          assignmentId: req.body.assignmentId,
          studentId: req.body.studentId,
          timestamp: req.body.timestamp,
          grade: req.body.grade,
          path: req.file.path,
          filename: req.file.filename,
          mimetype: req.file.mimetype
        }
        const submissionInfo = await insertNewSubmission(submission)
        console.log("Adding to collection: ", submissionInfo)
        const id = await saveSubmissionFile(submission)
        res.status(200).send({ id: id })
    }
    else {
        res.status(400).send({
            error: "The request body was either not present or did not contain a valid Submission object."
        })
    }
})


/* 
 * Function to check that a user is an admin or instructor of the course
 */
async function checkUser(user, assignmentId){
    if(user){
        if(user.role === "instructor"){
            assignment = getAssignmentById(assignmentId)
            course = getCourseById(assignment.courseId)
            if(user.instructorId === course.instructorId){
                return true
            }
            else return false
        }
        else if (user.role === "admin"){
            return true
        }
        else return false
    }
    else return false
}

module.exports = router
