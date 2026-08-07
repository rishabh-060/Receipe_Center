require('dotenv').config()

const express = require('express')
const mongoose = require('mongoose')
const userModel = require('./models/user')
const bcrypt = require('bcrypt')
const cookieParser = require('cookie-parser')
const jwt = require('jsonwebtoken')
const postModel = require('./models/post')
const path = require('path')
const upload = require('./config/multerConfig')

const app = express()
const PORT = Number.parseInt(process.env.PORT, 10) || 3000
const HOST = process.env.HOST || '0.0.0.0'
const JWT_SECRET = process.env.JWT_SECRET
const isProduction = process.env.NODE_ENV === 'production'

if (!process.env.MONGO_URI) {
    throw new Error('MONGO_URI is required')
}

if (!JWT_SECRET) {
    throw new Error('JWT_SECRET is required')
}

const authCookieOptions = {
    httpOnly: true,
    sameSite: 'lax',
    secure: isProduction,
}

app.set('view engine', 'ejs')
app.use(express.json())
app.use(express.urlencoded({extended : true}))
app.use(express.static(path.join(__dirname, "public")))
app.use(cookieParser())

app.get('/', (req, res) => {
    res.render('index')
})

app.get('/health', (req, res) => {
    const databaseConnected = mongoose.connection.readyState === 1
    res.status(databaseConnected ? 200 : 503).json({
        status: databaseConnected ? 'ok' : 'unavailable',
    })
})

app.get('/search', isLoggedIn, (req, res) => {
    res.render('search')
})

app.get('/profile/upload', isLoggedIn, (req, res) => {
    res.render('upload')
})

app.post('/upload', isLoggedIn, upload.single('file'), async (req, res) => {
    let user = await userModel.findOne({email : req.user.email})
    user.profilepic = req.file.filename
    await user.save()
    res.redirect('/profile')
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

app.get('/delete/:id', isLoggedIn, async (req, res) => {
    try {
        
        await postModel.findByIdAndDelete(req.params.id);

        res.redirect('/profile');
    } catch (error) {
        console.error("Error deleting post:", error);
        res.status(500).send("An error occurred while deleting the post.");
    }
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

            let token = jwt.sign({email: email, userid: user._id}, JWT_SECRET)
            res.cookie("token", token, authCookieOptions)
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
            let token = jwt.sign({email: email, userid: user._id}, JWT_SECRET)
            res.cookie("token", token, authCookieOptions)
            res.redirect('/profile')
        }
        else res.redirect("/login")
    })
})

app.get('/logout', (req, res) => {
    res.clearCookie("token", authCookieOptions)
    res.redirect("/login")
})

function isLoggedIn(req, res, next){
    const token = req.cookies.token

    if (!token) return res.redirect('/login')

    try {
        let data = jwt.verify(token, JWT_SECRET)
        req.user = data;
        next()
    } catch (error) {
        res.clearCookie('token', authCookieOptions)
        return res.redirect('/login')
    }
}

async function startServer() {
    try {
        await mongoose.connect(process.env.MONGO_URI)
        console.log('Connected to MongoDB')

        app.listen(PORT, HOST, () => {
            console.log(`Server listening on ${HOST}:${PORT}`)
        })
    } catch (error) {
        console.error('Failed to start server:', error.message)
        process.exitCode = 1
    }
}

startServer()
