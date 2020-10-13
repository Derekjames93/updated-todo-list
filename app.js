const express = require('express');
const session = require('express-session')
const db = require('./models');
const SequelizeStore =
  require('connect-session-sequelize')(session.Store);
const store = new SequelizeStore({ db: db.sequelize })

const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser')
const es6Renderer = require('express-es6-template-engine')
const bcrypt = require('bcrypt')

const app = express();
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cookieParser());
app.use(
  session({
    secret: 'pancakes', // used to sign the cookie
    resave: false, // update session even w/ no changes
    saveUninitialized: false, // always create a session
    store: store,
  }))

store.sync();

//middleware to show logins
app.use((req, res, next) => {
  console.log('===== USER =====')
  console.log(req.session.user);
  console.log('========')
  next();
})


app.use(express.static('./public'));

app.engine('html', es6Renderer); // use es6renderer for html view templates
app.set('views', 'templates'); // look in the 'templates' folder for view templates
app.set('view engine', 'html'); // set the view engine to use the 'html' views

// Check Auth
function checkAuth(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect('/login')
  }
}
// Login
app.get('/', checkAuth, (req, res) => {
  res.render('index', {
    locals: {
      user: req.session.user
    }
  })
})

//Logout
app.get('/logout', (req, res) => {
  req.session.user = null
  res.redirect('login')
})
// protects anything with this pattern
app.use('/api/*', checkAuth)
// Get register page
app.get('/register', (req, res) => {
  res.render('register', {
    locals: {
      error: null,
    }
  })
})


app.post('/register', (req, res) => {
  if (!req.body.email || !req.body.password) {
    res.render('register', {
      locals: {
        error: 'Please submit all required fields'
      }
    })
    return;
  }

  const { email, password } = req.body
  bcrypt.hash(password, 10, (err, hash) => {
    db.User.create({
      email: email,
      password: hash
    })
      .then((user) => {
        res.redirect('/login')
      })
  })
})


let todoList = [
  {
    id: 1,
    todo: 'Implement a REST API',
  },
];
// GET login page
app.get('/login', (req, res) => {
  res.render('login', {
    locals: {
      error: 'Please submit all required fields'
    }
  })
})


//Post
app.post('/login', (req, res) => {
  if (!req.body.email || !req.body.password) {
    res.render('/login', {
      locals: {
        error: 'Please submit all required fields'
      }
    })
    return;
  }

  db.User.findOne({
    where: {
      email: req.body.email
    }
  })
    .then((user) => {
      if (!user) {
        res.render('login', {
          locals: {
            error: 'No user with that email'
          }
        })
        return;
      }
      bcrypt.compare(req.body.password, user.password, (err, matched) => {
        if (matched) {
          req.session.user = user;
          // res.send('YOU LOGGED IN')
          res.redirect('/')
        } else {
          // res.send('WRONG PASSWORD')
          res.render('login', {
            locals: {
              error: 'Incorrect password. Please try again'
            }
          })
          return;
        }
        return;
      })
    })
})


// GET /api/todos
app.get('/api/todos',(req, res) => {
  db.Todo.findAll({
    where: {
      UserId: req.session.user.id
    },
    order: [
      [
        'id',
        'ASC'
      ]
    ]
  }) //find all of Todos
    .then((todos) => {
      res.json(todos); // return as Json
    })
    .catch((error) => {
      console.error(error); // if they are errors console log them
      res.status(500).json({ error: 'A Database Error Occurred' });
    })

});

// GET /api/todos/:id  fix this// Corrected!
app.get('/api/todos/:id', (req, res) => {
  const { id } = req.params;
  db.Todo.findOne({
    where: {
      id:id,
      UserId: req.session.user.id
    }
  })

    .then((todo) => {
      if (!todo) {
        res.status(404).json({ error: `Could not find todo with id :${id}` })
        return;
      }
      res.json(todo)
    })
    .catch((error) => {
      console.error(error);
      res.status(500).json({ error: 'A Database Error Occurred' });
    })
});

// POST /api/todos
app.post('/api/todos', (req, res) => {
  if (!req.body || !req.body.name) {
    res.status(400).json({
      error: 'Provide todo text',
    });
    return;
  }

  db.Todo.create({
    name: req.body.name,
    UserId: req.session.user.id
  })
    .then((newTodo) => {
      res.json(newTodo)
    })
    .catch((error) => {
      console.error(error); // if they are errors console log them
      res.status(500).json({ error: 'A Database Error Occurred' });
    })
});

app.put('/api/todos/mark/:id', (req,res) => {
  const { id } = req.params;
  db.Todo.findOne({
    
    where: {
      id: id,
      UserId: req.session.user.id
    }
  })
    .then((todo) => {
      if (!todo) {
        res.status(404).json({ error: `Could not find todo with id :${id}` })
        return;
      }else if (!todo.complete){
        todo.complete = true;
      } else {
        todo.complete = false;
      }
      todo.save();
      res.json(todo)
      
  })
  .catch((error) => {
    console.error(error); // if they are errors console log them
    res.status(500).json({ error: 'A Database Error Occurred' });
  })
})

// PUT /api/todos/:id   fix this
app.put('/api/todos/:id', (req, res) => {
  if (!req.body || !req.body.name) {
    res.status(400).json({
      error: 'Provide todo text',
    });
    return;
  }
  
  db.Todo.findOne({
    
    where: {
      id: id,
      UserId: req.session.user.id
    }
  })
    .then((todo) => {
      if (!todo) {
        res.status(404).json({ error: `Could not find Todo with id: ${id} ` })
        return;
      }
      todo.name = req.body.name;
      todo.save()
      res.json(todo);
    })
    .catch((error) => {
      console.error(error); // if they are errors console log them
      res.status(500).json({ error: 'A Database Error Occurred' });
    })
});

// DELETE /api/todos/:id  fix this
app.delete('/api/todos/:id', (req, res) => {
  db.Todo.destroy({
    where: {
      id:req.params.id,
      UserId: req.session.user.id
    }
  })
    .then((deleted) => {
      if (deleted === 0) {
        res.status(404).json({ error: `Could not find Todo with id: ${id} ` })
        return
      }
      res.status(204).json()
    })
    .catch((error) => {
      console.error(error); // if they are errors console log them
      res.status(500).json({ error: 'A Database Error Occurred' });
    })
});

app.listen(3000, function () {
  console.log('Todo List API is now listening on port 3000 ...');
});
