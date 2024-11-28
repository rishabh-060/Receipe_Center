const express = require('express')
const userModel = require('./models/user')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const postModel = require('./models/post')

const app = express()
const PORT = 3000

app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(cookieParser())

app.get('/', (req, res) => {
    res.render('index')
})

app.get('/search', isLoggedIn, (req, res) => {
    res.render('search')
})

app.get('/allposts', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email : req.user.email}).populate('posts')
    let alluser = await userModel.find();
    const posts = await postModel.find();
    
    if(posts) return res.render('allReceipes', {user, posts, alluser})
    res.send("Post not Found")
})

app.get('/profile', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email : req.user.email}).populate('posts')
    if(user) return res.render('profile', {user})
    res.send("User not found")
})

app.get('/add-receipe', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email : req.user.email})
    if(user) return res.render('receipe', {user})
})

app.post('/post', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email : req.user.email})
    let {title, image, description} = req.body;

    let post = await postModel.create({
        user : user._id,
        title : title,
        image : image,
        description : description,
    })

    user.posts.push(post._id)
    await user.save()
    res.redirect('/profile')
})

app.get('/like/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOne({_id: req.params.id}).populate('user')
    
    if(post.likes.indexOf(req.user.userid) === -1){
        post.likes.push(req.user.userid)
    }
    else{
        post.likes.splice(post.likes.indexOf(req.user.userid), 1)
    }

    await post.save()
    res.redirect("/profile")
})

// Edit feature :-
app.get('/edit/:id', isLoggedIn, async (req, res) => {
    let user = await userModel.findOne({email : req.user.email})
    let post = await postModel.findOne({_id: req.params.id}).populate('user')
    
    res.render("edit", {post, user})
})

app.post('/update/:id', isLoggedIn, async (req, res) => {
    let post = await postModel.findOneAndUpdate({_id: req.params.id}, {description : req.body.description})
    res.redirect('/profile')
})

app.get('/login', (req, res) => {
    res.render('login')
})

app.post('/register', async (req, res) => {
    let {email, name, username, age, password} = req.body;

    let user = await userModel.findOne({email})
    if (user) return res.status(500).send("Email already exists")
    
    bcrypt.genSalt(10, (err, salt) => {
        bcrypt.hash(password, salt, async (err, hash) => {
            let user = await userModel.create({
                username,
                email,
                name,
                age,
                password: hash
            })

            let token = jwt.sign({email: email, userid: user._id}, "shhhh")
            res.cookie("token", token)
            res.render('login')
        })
    })
})

app.post('/login', async (req, res) => {
    let {email, password} = req.body;

    let user = await userModel.findOne({email})
    if (!user) return res.status(500).send("Email not registered")
    
    bcrypt.compare(password, user.password, function(err, result){
        if(result) {
            let token = jwt.sign({email: email, userid: user._id}, "shhhh")
            res.cookie("token", token)
            res.redirect('/profile')
        }
        else res.redirect("/login")
    })
})

app.get('/logout', (req, res) => {
    res.cookie("token", "")
    res.redirect("/login")
})

function isLoggedIn(req, res, next){
    if(req.cookies.token === "") res.redirect("login")
    else {
        let data = jwt.verify(req.cookies.token, "shhhh")
        req.user = data;
        next()
    }
}


app.listen(PORT, () => {
    console.log(`server started http://localhost:${PORT}`)
})