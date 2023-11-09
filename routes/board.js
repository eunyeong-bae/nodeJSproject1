const router = require('express').Router();

router.get('/sports', checkLogin, (request,response) => {
    response.send('스포츠 게시판')
})
router.get('/game', checkLogin, (request,response) => {
    response.send('게임 게시판')
}) 

module.exports = router;