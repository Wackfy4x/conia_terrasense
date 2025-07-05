var createError = require('http-errors');
var express = require('express');
var path = require('path');
var cookieParser = require('cookie-parser');
var logger = require('morgan');
require('dotenv').config();
var indexRouter = require('./routes/index');
const http = require('http'); // Importer le module HTTP
const { Server } = require("socket.io");

var app = express();


const server = http.createServer(app); // Créer un serveur HTTP à partir de votre application Express
const io = new Server(server, {
  cors: { // Configuration CORS pour autoriser les connexions depuis le client
    origin: "*", // Autoriser toutes les origines (À configurer plus précisément en production)
    methods: ["GET", "POST", "PUT", "PATCH"],
  }
});
const usersRouter = require('./routes/users');
// view engine setup
app.set('views', path.join(__dirname, 'views'));
app.set('view engine', 'jade');

app.use(logger('dev'));
app.use(express.json());
app.use('/files', express.static(path.join(__dirname, 'uploads')));
app.use(express.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
  req.app.set('socketio', io);
  next()
});

// app.use('/', indexRouter);
app.use('/', usersRouter);

// catch 404 and forward to error handler
app.use(function(req, res, next) {
  next(createError(404));
});

// error handler
app.use(function(err, req, res, next) {
  // set locals, only providing error in development
  res.locals.message = err.message;
  res.locals.error = req.app.get('env') === 'development' ? err : {};

  // render the error page
  res.status(err.status || 500);
  res.render('error');
});


module.exports = {
  app,
  io,
};
