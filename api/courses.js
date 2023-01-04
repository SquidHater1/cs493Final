/*
 * API sub-router for courses endpoints.
 */

const { Router } = require('express')
const { requireAdmin, courseAuthentication } = require('../lib/auth')
const { validateAgainstSchema } = require('../lib/validation')
const { 
    getCoursesPage, CourseSchema, insertNewCourse, getStudentsByCourseId, 
    deleteCourse, addStudentToCourse, removeStudentFromCourse, getCourseById, 
    updateCourseById, getAssignmentsByCourseId, getCourseRoster } = require('../models/course')
const { getUserById } = require('../models/user')

const fs = require('fs')
const json2csv = require('json2csv')

const router = Router()


/*
 * Fetch the list of all courses.
 * The list shoudl be paginated and not contain the list of students or assignments.
 */
router.get('/', async function (req, res){
    try {

        const coursePage = await getCoursesPage(parseInt(req.query.page) || 1)
        coursePage.links = {}
        if (coursePage.page < coursePage.totalPages) {
            coursePage.links.nextPage = `/courses?page=${coursePage.page + 1}`
            coursePage.links.lastPage = `/courses?page=${coursePage.totalPages}`
        }
        if (coursePage.page > 1) {
            coursePage.links.prevPage = `/courses?page=${coursePage.page - 1}`
            coursePage.links.firstPage = `/courses?page=1`
        }
        res.status(200).send(coursePage)

    } catch (err) {
        console.error(err)
        res.status(500).send({
            error: "Error fetching course list. Please try again later"
        })
    }
})


/*
 * Create a new course.
 * Only an authenticated User with 'admin role can create a new Course.
 */
router.post('/', requireAdmin, async function (req, res) {
    if(validateAgainstSchema(req.body, CourseSchema)) {
        try {
            const instructor = await getUserById(req.body.instructorId)

            if(instructor && instructor.role === "instructor"){
                const id = await insertNewCourse(req.body)
                res.status(201).send({
                    id: id
                })
            }else{
                res.status(401).send({
                    error: "Invalid instructor id"
                })
            }
        } catch (err) {
            console.error(err)
            res.status(500).send({
                error: "Error inserting course into DB. Please try again later."
            })
        }
    } else {
        res.status(400).send({
            error: "Request body is not a valid course object"
        })
    }
})


/* 
 * Fetch data about a specific Course.
 * Return data about a course, excluding list of students and assignments.
 */
router.get('/:id', async function (req, res){
    try {
        const result = await getCourseById(req.params.id)
        if(result){
            const thisCourse = {
                _id: result._id,
                subject: result.subject,
                number: result.number,
                title: result.title,
                term: result.term,
                instructorId: result.instructorId
            }
            res.status(200).json(thisCourse)
        }else{
            res.status(404).send({
                error: "No course found for id: " + req.params.id
            })
        }
    }catch (err) {
        console.error(err)
        res.status(500).send({
            error: "Error getting course. Please try again later."
        })
    }
})


/* 
 * Update data for a specific Course.
 * Enrolled students and assignments cannot be modified via this endpoint.
 * Only an authenticated User with 'admin' role or an authenticated 'instructor' may update.
 */
router.patch('/:id', courseAuthentication, async function (req, res){
    if(validateAgainstSchema(req.body, CourseSchema)) {
        try {
            const success = await updateCourseById(req.params.id, req.body)
            if(success){
                res.status(200).send()
            }
            else{
                res.status(404).send({
                    error: "Specified Course: " + req.params.id + " not found"
                })
            }
        } catch (err) {
            console.error(err)
            res.status(500).send({
                error: "Error inserting Course into DB. Please try again later."
            })
        }
    } else {
        res.status(400).send({
            error: "Request body is not a valid Course object"
        })
    }
})


/* 
 * Remove a specific Course from the database. 
 * Completely remove the data including all enrolled students, all Assignments, etc.
 * Only an authenticated User with 'admin' role can remove a Course.
 */
router.delete('/:id', requireAdmin, async function (req, res){
    try {
        const success = await deleteCourse(req.params.id)
        console.log("succes: ", success)
        if(success){
            res.status(204).send()
        }else if(success == false){
            res.status(404).send({
                error: "Specified course not found"
            })
        }
    } catch(err){
        console.error(err)
        res.status(500).send({
            error: "Error deleting course from DB. Please try again later."
        })
    }
})


/* 
 * Fetch a list of all students enrolled in the Course.
 * Only an authenticated User with 'admin' or 'instructor' role can fetch the list of students.
 */
router.get('/:id/students', courseAuthentication, async function (req, res) {
    try {
        const studentList = await getStudentsByCourseId(req.params.id)
        if(studentList != null){
            res.status(200).send({
                studentList
            })
        }else{
            res.status(404).send({
                error: "No courses found for the specified id"
            })
        }
    }catch (err) {
        console.error(err)
        res.status(500).send({
            error: "Error getting student list. Please try again later."
        })
    }
})


/*
 * Update enrollment for a Course. 
 * Enrolls and/or unenrolls students from a Course. 
 * Only an authenticated User with 'admin' or 'instructor' role can update enrollment. 
 */
router.post('/:id/students', courseAuthentication, async function (req, res) {
    try {
        if(req.body && req.body.add && req.body.remove && Array.isArray(req.body.add) && Array.isArray(req.body.remove)){
            const addedList = []
            for(let i = 0; i < req.body.add.length; i++){
                const result = await addStudentToCourse(req.params.id, req.body.add[i])
                console.log("Result: ", result)
                if(result){
                    addedList.push(req.body.add[i])
                }
            }
            const removedList = []
            for(let i = 0; i < req.body.remove.length; i++){
                const result = await removeStudentFromCourse(req.params.id, req.body.remove[i])
                if(result){
                    removedList.push(req.body.remove[i])
                }
            }
            res.status(200).send({
                added: addedList,
                removed: removedList
            })
        }else{
            res.status(400).send({
                error: "Request body needs arrays add and remove"
            })
        }
    }catch (err) {
        console.error(err)
        res.status(500).send({
            error: "Error altering students. Please try again later"
        })
    }
})


/*
 * Fetch a CSV file containing list of the students enrolled in the Course.
 * Information including names, IDs, and email addresses. 
 * Only an authenticated 'admin' or 'instructor' user may fetch the course roster. 
 */
router.get('/:id/roster', courseAuthentication, async function (req, res) {
    try {
        const studentList = await getCourseRoster(req.params.id)
        console.log("studentList: ", studentList)
        if(studentList != null){
           const fields = ['name', 'email', 'password', 'role']
           var data = json2csv.parse({ data: studentList, fields: fields})
           console.log("data: ", data)
           res.attachment('roster.csv')
           res.status(200).send(data)
        }else{
            res.status(404).send({
                error: "No courses found for the specified id"
            })
        }
    }catch (err) {
        console.error(err)
        res.status(500).send({
            error: "Error getting student list. Please try again later."
        })
    }
})


/* 
 * Fetch a list of the Assignments for the Course.
 * Returns a list containing the assignment IDs of all the Assignments for the Course. 
 */
router.get('/:id/assignments', async function (req, res) {
    try {
        assignmentList = await getAssignmentsByCourseId(req.params.id)
        if(assignmentList){
            res.status(200).send({
                assignments: assignmentList
            })
        }else{
            res.status(404).send({
                error: "Specified Course" + req.params.id + "not found."
            })
        }
    }catch (err) {
        console.error(err)
        res.status(500).send({
            error: "Error gathering assignment list. Please try again later"
        })
    }
})

module.exports = router