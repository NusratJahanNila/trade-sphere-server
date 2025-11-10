const express = require('express');
const cors = require('cors');
const app=express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port=process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Mongodb
require('dotenv').config()
const uri = `mongodb+srv://${process.env.DB_USERNAME}:${process.env.DB_PASSWORD}@cluster0.sa5bapo.mongodb.net/?appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    // colection
    const db = client.db("trade-db")
    const productsCollection = db.collection('products')

    // All product 
    app.get('/products', async (req, res) => {
        const result = await productsCollection.find().toArray();
        res.send(result);
    })
    // Product details
    app.get('/products/:id', async (req, res) => {
        const id = req.params.id;
        const query = { _id: new ObjectId(id) }

        const result = await productsCollection.findOne(query);
        res.send(result)
      })

    // ping
    await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);


// Read data
app.get('/',(req,res)=>{
    res.send('Server is running')
})

// listen data
app.listen(port,()=>{
    console.log(`Server is running on port: ${port}`)
})