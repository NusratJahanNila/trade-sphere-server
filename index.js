const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const port = process.env.PORT || 3000;

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
    const importCollection = db.collection('imports')

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

    // Latest products
    app.get('/latest-products', async (req, res) => {
      const result = await productsCollection.find().sort({ exportAt: -1 }).limit(6).toArray()
      res.send(result)
    })

    // Add export
    app.post('/products', async (req, res) => {
      const newProduct = req.body;
      const result = await productsCollection.insertOne(newProduct)
      res.send(result)
    })

    // My Export
    app.get('/my-export', async (req, res) => {
      const email = req.query.email;
      const query = { exportBy: email }

      const result = await productsCollection.find(query).toArray();
      res.send(result);
    })

    // Update My-Export
    app.put('/my-export/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }

      const data = req.body;
      const update = {
        $set: data
      }
      const result = await productsCollection.updateOne(query, update)
      res.send(result)
    })

    // Delete my-export
    app.delete('/my-export/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }

      const result = await productsCollection.deleteOne(query)
      res.send(result)
    })

    // Add import
    app.post('/imports', async (req, res) => {
      const newProduct = req.body;
      const result = await importCollection.insertOne(newProduct)

      // minus quantity
      const importQuantity = newProduct.userQuantity;
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }
      const update = {
        $inc: { availableQuantity: -importQuantity }
      }
      const remainQuantity = await productsCollection.updateOne(query, update)
      res.send({ result, remainQuantity })
    })

    //My import
    app.get('/my-imports', async (req, res) => {
      const email = req.query.email;
      const query = { importBy: email }

      const result = await importCollection.find(query).toArray();
      res.send(result)
    })

    //search

    app.get('/search', async (req, res) => {
      const searchData = req.query.search;
      const result = await productsCollection.find({ productName: { $regex: searchData, $options: "i" } }).toArray()
      res.send(result);
    })

    // Delete my-import
    app.delete('/my-imports/:id', async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) }

      const result = await importCollection.deleteOne(query)
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
app.get('/', (req, res) => {
  res.send('Server is running')
})

// listen data
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`)
})