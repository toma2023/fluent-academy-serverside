const express = require('express');
const app = express();
const cors = require('cors');
const jwt = require('jsonwebtoken');
require('dotenv').config()
const port = process.env.PORT || 5000;

// middleware
app.use(cors());
app.use(express.json());


const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: 'Unauthorized Access' });
    }
    //bearer token
    const token = authorization.split(' ')[1];
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: 'Unauthorized Access' })
        }
        req.decoded = decoded;
        next();
    })


}


const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.rdylw4f.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();
        const instructorsCollections = client.db("academyDB").collection("instructors");

        const usersCollections = client.db("academyDB").collection("users");
        const classCollections = client.db("academyDB").collection("class");
        const selectCollections = client.db("academyDB").collection("selects");



        //jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' })
            res.send({ token })
        })

        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query);
            if (user?.role !== 'admin') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        const verifyInstructor = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email }
            const user = await usersCollections.findOne(query);
            if (user?.role !== 'instructor') {
                return res.status(403).send({ error: true, message: 'forbidden message' });
            }
            next();
        }

        //user related apis
        //create user
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email }
            const existingUser = await usersCollections.findOne(query);

            if (existingUser) {
                return res.send({ message: 'user already exists' })
            }

            const result = await usersCollections.insertOne(user);
            res.send(result);
        })
        //get user
        app.get('/users', verifyJWT, verifyAdmin, async (req, res) => {
            const result = await usersCollections.find().toArray();
            res.send(result);
        })


        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ admin: true })
            }
            const query = { email: email }
            const user = await usersCollections.findOne(query);
            const result = { admin: user?.role === 'admin' }
            res.send(result);
        })
        //create admin   
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'admin'
                },
            };
            const result = await usersCollections.updateOne(filter, updateDoc);
            res.send(result);
        })

        app.get('/users/instructor/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;
            if (req.decoded.email !== email) {
                res.send({ instructor: false })
            }
            const query = { email: email }
            const user = await usersCollections.findOne(query);
            const result = { instructor: user?.role === 'instructor' }
            res.send(result);
        })


        //create instructor
        app.patch('/users/instructor/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    role: 'instructor'
                },
            };
            const result = await usersCollections.updateOne(filter, updateDoc);
            res.send(result);
        })



        //instructors related apis
        app.get('/instructors', async (req, res) => {
            const result = await instructorsCollections.find().toArray();
            res.send(result);
        })

        //verifyJWT, verifyAdmin,
        app.post('/addClass', verifyJWT, verifyInstructor, async (req, res) => {
            const newItem = req.body;
            const result = await classCollections.insertOne(newItem)
            res.send(result);
        })

        app.get('/addClass', async (req, res) => {
            const result = await classCollections.find().toArray();
            res.send(result);
        })

        //manage status
        app.patch('/addClass/:id', async (req, res) => {
            const id = req.params.id;
            const { status } = req.body;
            console.log(id)
            const filter = { _id: new ObjectId(id) }
            const updateDoc = {
                $set: {
                    status: status
                },
            };
            const result = await classCollections.updateOne(filter, updateDoc);
            res.send(result);
        })

        //selected courses
        app.post('/selects', async (req, res) => {
            const item = req.body;
            const result = await selectCollections.insertOne(item);
            res.send(result);
        })
        //update cart count(useSelected courses)
        app.get('/selects', verifyJWT, async (req, res) => {
            const email = req.query.email;
            if (!email) {
                res.send([]);
            }

            const query = { email: email };
            const result = await selectCollections.find(query).toArray();
            res.send(result);
        })
        //delete my selected class
        app.delete('/selects/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await selectCollections.deleteOne(query);
            res.send(result);
        })



        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        //await client.close();
    }
}
run().catch(console.dir);




app.get('/', (req, res) => {
    res.send('Fluent academy is running')
})

app.listen(port, () => {
    console.log(`Fluent academy is running on port ${port}`);
})
