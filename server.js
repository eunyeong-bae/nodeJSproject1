const express = require('express');
const app = express();
const {MongoClient, ObjectId} = require('mongodb');
const methodOverride = require('method-override');
const bcrypt = require('bcrypt');
require('dotenv').config();

app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs'); //ejs 셋팅 끝
//request.body 쓰려면 필요한 설정
app.use(express.json())
app.use(express.urlencoded({extended: true}))

//passport lib 셋팅
const session = require('express-session');
const passport = require('passport');
const LocalStrategy = require('passport-local');
const MongoStore = require('connect-mongo');
const connectDB = require('./database.js');

app.use(passport.initialize());
app.use(session({
    secret: 'qwert123',
    resave: false, //유저가 서버로 요청할 때마다 세션 갱신할건지
    saveUninitialized: false, // 로그인 안해도 세션 만들것인지,
    cookie: { maxAge: 60 * 60 * 1000 },
    store: MongoStore.create({
        mongoUrl: process.env.DB_URL,
        dbName: 'nodeForum'
    })
}));
app.use(passport.session());



let db;
connectDB.then((client) => {
    // console.log('db connect success')
    db = client.db('nodeForum')

    //서버 띄울 port 번호
    app.listen(process.env.PORT, () => {
        console.log('http://localhost:8080 에서 서버 실행 중')
    })

}).catch((error) => {
    console.log(error)
})


passport.use(new LocalStrategy(async (id, pw, cb) => {
    try{
        let result = await db.collection('user').findOne({ username: id})
        if(!result){
            return cb(null, false, {message : 'ID DB 에 없음'})
        }

        if(await bcrypt.compare(pw, result.password)){
            return cb(null, result)
        } else {
            return cb(null, false, {message: '비번 불일치'})
        }
    }catch(e) {
        console.log(e)
    }
}))

passport.serializeUser((user, done) => {
    process.nextTick(() => { //내부 코드를 비동기적으로 처리하고 싶을 때 사용하는 코드
        done(null, { id: user._id, username: user.username})
    })
})

//유저가 보낸 쿠키를 분석해주는 코드
passport.deserializeUser( async (user, done) => {
    let result = await db.collection('user').findOne({_id: new ObjectId(user.id)})
    delete result.password;

    process.nextTick(() => { //내부 코드를 비동기적으로 처리하고 싶을 때 사용하는 코드
        done(null, result)
    })
})

function checkLogin(request, response, next) {
    if(!request.user){
        response.send('로긴하세요')
    }
    next(); //미들웨어 코드 실행 끝났으니 다음으로 실행해주세요
}

function emptyInputCheck(request, response, next){
    if(request.body.username !== '' || request.body.password !== ''){
        next();
    } else {
        response.status(400).json('아이디, 비번 빈칸 안돼염')
    }
}

//서버 기능 구현
//checkLogin 는 미들웨어임
app.get('/', (request, response) => {
    response.sendFile(__dirname+'/index.html')
})

app.get('/list', (request, response, next) => {console.log(new Date()); next()}, async (request, response) => {
    let result = await db.collection('post').find().toArray()
    response.render('list.ejs', {posts: result})
})

app.get('/write', async (request, response) => {
    response.render('write.ejs')
})

app.post('/newpost', async (request, response) => {
    //예외처리
    try{
        if(request.body.title == '' || request.body.content == ''){
            response.send('title 빈칸 안된다')
        } else {
            await db.collection('post').insertOne({
                title: request.body.title,
                content: request.body.content
            });
            response.redirect('/list')
        }
    } catch(e) {
        console.log(e)
        //서버에서 에러 났을 때, 500번
        response.status(500).send('error 남')
    }
})

app.get('/detail/:id', async (request, response) => {
    try {
        let result = await db.collection('post').findOne({_id: new ObjectId(request.params.id)})
        if(result == null) {
            response.status(404).send('이상한 url 입력함')
        }

        response.render('detail.ejs', {data : result})

    }catch(e) {
        console.log(e)
        response.status(500).send('서버 오류')
    }
})

app.get('/edit/:id', async (request, response) => {
    console.log('edit: ', request.user)
    if(request.user?.username) {
        let result = await db.collection('post').findOne({_id: new ObjectId(request.params.id)})
        
        response.render('edit.ejs', {result: result})
    } else {
        return response.status(400).json('로그인 한 유저만 글 작성이 가능합니다.')
    }
})

app.put('/edit', async (request, response) => {
    await db.collection('post').updateOne(
        {_id: new ObjectId(request.body._id)},
        {
            $set: {
                title:  request.body.title,
                content: request.body.content
            }
        }
    )

    response.redirect('/list');
})

app.delete('/delete', async (request, response) => {
    // console.log(request.query)
    await db.collection('post').deleteOne({
        _id: new ObjectId(request.query.docId)
    })
    response.send('success')
})

//pagination 첫번쨰
app.get('/list/:id', async (request, response) => {
    // console.log(request.params)
    let result = await db.collection('post')
        .find()
        .skip((request.params.id - 1)*5)
        .limit(5)
        .toArray()

    response.render('list.ejs', {posts: result})
})

//pagination 두번째 방법
app.get('/list/next/:id', async (request, response) => {
    // console.log(request.params)
    let result = await db.collection('post')
        .find({_id: {$gt : new ObjectId(request.params.id) }})
        .limit(5)
        .toArray()

    response.render('list.ejs', {posts: result})
})

app.get('/login', (request, response) => {
    response.render('login.ejs')
})

app.post('/login', emptyInputCheck, async (request, response, next) => {
    passport.authenticate('local', (error, user, info)=> {
        // console.log(user, info)
        if(error) return response.status(500).json(error);
        if(!user) return response.status(401).json(info.message);
        
        request.logIn(user, (err)=> {
            if(err) return next(err)

            response.render('myPage.ejs', {user: user});
        })
    })(request, response, next)
})

app.get('/register', (request, response) => {
    response.render('register.ejs')
})

app.post('/register', emptyInputCheck, async (request, response)=> {

    let hash = await bcrypt.hash(request.body.password, 10);

    if(request.body.username == '') return response.status(400).json('username 빈칸 작성 불가')
    if(request.body.password.length < 5) return response.status(400).json('비번이 너무 짧음')
    
    let result = await db.collection('user').findOne({username: request.body.username});
    // console.log(result)
    if(request.body.username === result?.username) return response.status(400).json('이미 가입되어있습니다.')

    await db.collection('user').insertOne({
        username: request.body.username,
        password: hash
    })

    response.redirect('/')
})

app.use('/shop', require('./routes/shop.js'))

app.use('/board/sub', require('./routes/board.js'))

//조회  /post GET
//발행  /post POST
//수정  /post PUT
//삭제  /post DELETE