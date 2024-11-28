const mongoose = require('mongoose')

const postSchema = mongoose.Schema({
    user : {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'user'
    },
    date : {
        type: Date,
        default: Date.now
    },
    title: String,
    description: String,
    image: {
      type: Buffer,
      required: true,
    },
    likes: [
        {type: mongoose.Schema.Types.ObjectId, ref: 'user'}
    ]
})

module.exports = mongoose.model('post', postSchema)