const connectDB = require('../database');

const router = require('express').Router();


let db;
connectDB.then((client) => {
    db = client.db('nodeForum')
}).catch((error) => {
    console.log(error)
})


router.get('/shirts', (request, response) => {
    response.send('셔츠파는 페이지')
})
router.get('/pants', (request, response) => {
    response.send('바지파는 페이지')
})

module.exports = router;