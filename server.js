const express = require('express');
const app = express();
const {MongoClient, ObjectId} = require('mongodb');
const methodOverride = require('method-override');

app.use(methodOverride('_method'));
app.use(express.static(__dirname + '/public'))
app.set('view engine', 'ejs'); //ejs 셋팅 끝
//request.body 쓰려면 필요한 설정
app.use(express.json())
app.use(express.urlencoded({extended: true}))




let db;
const url = 'mongodb+srv://admin:qwer1234@cluster0.ufvmf9v.mongodb.net/?retryWrites=true&w=majority';
new MongoClient(url).connect().then((client) => {
    // console.log('db connect success')
    db = client.db('nodeForum')

    //서버 띄울 port 번호
    app.listen(8080, () => {
        console.log('http://localhost:8080 에서 서버 실행 중')
    })

}).catch((error) => {
    console.log(error)
})


//서버 기능 구현
app.get('/', (request, response) => {
    response.sendFile(__dirname+'/index.html')
})

app.get('/list', async (request, response) => {
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
    let result = await db.collection('post').findOne({_id: new ObjectId(request.params.id)})
    
    response.render('edit.ejs', {result: result})
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

