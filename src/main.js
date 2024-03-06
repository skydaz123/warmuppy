const express = require('express');
const path = require('path');
const session = require("express-session");
const MongoStore = require("connect-mongo");
const app = express();

app.use(
    session({
        secret: "abc",
        cookie: {
            maxAge: 1000 * 60 * 60 * 7,
        },
        resave: false,
        saveUninitialized: true,
        store: MongoStore.create({
            mongoUrl: "mongodb://194.113.75.57:27017",
        }),
    }),
)

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '../public')));

app.get("/hello", (request, response) => {
    if (request.session.something === undefined){
        request.session.something = 1;
    }
    else{
        request.session.something++;
    }
    response.json({
        something: request.session.something
    })
})

app.post("/adduser", (request, response) => {

})

// Start the server
const port = 80;
app.listen(port, () => {
  console.log(`Server is running on port ${port}`);
});
