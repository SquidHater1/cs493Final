const { ObjectId } = require('mongodb')

const { getDbReference } = require('../lib/mongo')
const { extractValidFields } = require('../lib/validation')
const { getUserById } = require('./user')

/* 
 * CourseSchema for validation
 */
const CourseSchema = {
    subject: { required: true },
    number: { required: true },
    title: { required: true },
    term: { required: true },
    instructorId: { required: true }
}
exports.CourseSchema = CourseSchema


/* 
 * Function to fetch full page of courses
 */
async function getCoursesPage(page) {
    const db = getDbReference()
    const collection = db.collection('courses')
    const count = await collection.countDocuments()

    const pageSize = 10
    const lastPage = Math.ceil(count / pageSize)
    page = page > lastPage ? lastPage : page
    page = page < 1 ? 1 : page
    const offset = (page - 1) * pageSize

    const results = await collection.find({})
        .sort({ _id: 1 })
        .skip(offset)
        .limit(pageSize)
        .toArray()

    for(let i = 0; i < results.length; i++){
        results[0] = {
            id: results[0]._id,
            subject: results[0].subject,
            number: results[0].number,
            title: results[0].title,
            term: results[0].term,
            instructorId: results[0].instructorId
        }
    }

    return {
        courses: results,
        page: page,
        totalPages: lastPage,
        pageSize: pageSize,
        count: count
    }
}
exports.getCoursesPage = getCoursesPage


/* 
 * Function to create a new Course and insert into DB.
 */
async function insertNewCourse(course) {
    course = extractValidFields(course, CourseSchema)
    const db = getDbReference()
    const collection = db.collection('courses')
    course.students = []
    course.assignments = []
    const result = await collection.insertOne(course)
    return result.insertedId
}
exports.insertNewCourse = insertNewCourse


/* 
 * Function to remove a course from the DB
 */
async function deleteCourse(courseId){
    const db = getDbReference()
    const collection = db.collection('courses')
    const success = await collection.deleteOne({_id: new ObjectId(courseId)})
    return success.deletedCount > 0
}
exports.deleteCourse = deleteCourse


/* 
 * Function to get a specific course by Id
 * Note that students and assignments are not included.
 */
async function getCourseById(courseId){
    const db = getDbReference()
    const collection = db.collection('courses')
    courseId = new ObjectId(courseId)
    const result = await collection.find({_id: courseId}).toArray()
    //console.log("==Checking for user with id: ", courseId)
    //console.log("== got result: ", result[0])
    return result[0]
}
exports.getCourseById = getCourseById


/*
 * Function to get students enrolled in a course
 */
async function getStudentsByCourseId(courseId){
    const db = getDbReference()
    const collection = db.collection('courses')
    courseId = new ObjectId(courseId)
    const result = await collection.find({_id: courseId}).toArray()

    if(result[0]){
        return { students: result[0].students }
    }else{
        return null
    }
}
exports.getStudentsByCourseId = getStudentsByCourseId


/*
 * Function to add a student to a course
 */
async function addStudentToCourse(courseId, studentId){
    const thisStudent = await getUserById(studentId)

    if(thisStudent && thisStudent.role === "student"){
        const thisCourse = await getCourseById(courseId)
        if(thisCourse){
            console.log("This course: ", thisCourse)
            const getStudents = await getStudentsByCourseId(courseId)
            //console.log("getStudentsByCourseId: ", await getStudentsByCourseId(courseId))
            const studentsList = getStudents.students
            console.log("studentList: ", studentsList)
            if(studentsList.indexOf(studentId) == -1){
                studentsList.push(studentId)

                const newCourse = {
                    subject: thisCourse.subject,
                    number: thisCourse.number,
                    title: thisCourse.title,
                    term: thisCourse.term,
                    instructorId: thisCourse.instructorId,
                    students: studentsList
                }
                const db = getDbReference()
                const collection = db.collection('courses')
    
                const result = await collection.replaceOne({
                    _id: new ObjectId(courseId)
                }, newCourse)
                return result.matchedCount > 0
            }else{
                return false
            }
        }else{
            return false
        }
    }else{
        return null
    }
}
exports.addStudentToCourse = addStudentToCourse


/* 
 * Function to remove a student from a course
 */
async function removeStudentFromCourse(courseId, studentId){
    const thisCourse = await getCourseById(courseId)
        if(thisCourse){
            const getStudents = await getStudentsByCourseId(courseId)
            const studentsList = getStudents.students
            const index = studentsList.indexOf(studentId)
            if(index !== -1){
                studentsList.splice(index, 1)
            }else{
                return false
            }
            const newCourse = {
                subject: thisCourse.subject,
                number: thisCourse.number,
                title: thisCourse.title,
                term: thisCourse.term,
                instructorId: thisCourse.instructorId,
                students: studentsList
            }
            const db = getDbReference()
            const collection = db.collection('courses')

            const result = await collection.replaceOne({
                _id: new ObjectId(courseId)
            }, newCourse)
            return result.matchedCount > 0
        }else{
            return false
        }
}
exports.removeStudentFromCourse = removeStudentFromCourse


/* 
 * Function to update a specific course
 */
async function updateCourseById(id, body){
    const db = getDbReference()
    const collection = db.collection('courses')
    const CourseValues = {
        subject: body.subject,
        number: body.number,
        title: body.title,
        term: body.term,
        instructorId: body.instructorId
    }
    const result = await collection.replaceOne(
        {_id: new ObjectId(id) }, 
        CourseValues
    )
    return result.matchedCount > 0
}
exports.updateCourseById = updateCourseById


/*
 * Function to get assignments for a course
 */
async function getAssignmentsByCourseId(id){
    const db = getDbReference()
    const collection = db.collection('assignments')

    const result = await collection.find({
        courseId: id
    }).toArray();
    return result
}
exports.getAssignmentsByCourseId = getAssignmentsByCourseId


/*
 * Function to get student roster
 */
async function getCourseRoster(courseId){
    const db = getDbReference()
    const course_collection = db.collection('courses')
    courseId = new ObjectId(courseId)
    const result = await course_collection.find({_id: courseId}).toArray()
    console.log("result: ", result[0])
    console.log("students: ", result[0].students)
    const roster = []
    const n_students = result[0].students.length
    console.log("found " + n_students + " students in course")


    for(let i = 0; i < n_students; i++) {
        const studentId = result[0].students[i]
        console.log("student #" + i + ": id: ")
        const studentInfo = await getUserById(studentId)
        roster.push(studentInfo)
    }
    
    if (roster.length == n_students){
        console.log("roster: ", roster)
        return roster
    }
}
exports.getCourseRoster = getCourseRoster
