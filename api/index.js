const { Router } = require('express')

const router = Router()

//All different routes for the api requests
router.use('/users', require('./users'))
router.use('/courses', require('./courses'))
router.use('/assignments', require('./assignments'))
router.use('/submissions', require('./submissions'))

module.exports = router