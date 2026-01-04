const express = require('express');
const cors = require('cors');
const app = express();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
require('dotenv').config()
const port = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());


// Mongodb
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
    // await client.connect();
    // colection
    const db = client.db("trade-db")
    const productsCollection = db.collection('products')
    const importCollection = db.collection('imports')

    // All product 
    app.get('/products', async (req, res) => {
      const {
        page = 1,
        limit = 8,
        category,
        rating,
        sort,
        search
      } = req.query;

      let query = {};

      // Category filter
      if (category && category !== 'all') {
        query.category = category;
      }

      // Rating filter
      if (rating && rating !== 'all') {
        const minRating = parseFloat(rating);
        query.rating = { $gte: minRating };
      }

      // Search
      if (search) {
        query.$or = [
          { productName: { $regex: search, $options: 'i' } },
          { brand: { $regex: search, $options: 'i' } },
          { category: { $regex: search, $options: 'i' } }
        ];
      }

      // Sort
      let sortOption = {};
      switch (sort) {
        case 'oldest': sortOption = { exportAt: 1 }; break;
        case 'price-low': sortOption = { price: 1 }; break;
        case 'price-high': sortOption = { price: -1 }; break;
        default: sortOption = { exportAt: -1 }; // newest
      }

      const skip = (parseInt(page) - 1) * parseInt(limit);
      const total = await productsCollection.countDocuments(query);

      const result = await productsCollection
        .find(query)
        .sort(sortOption)
        .skip(skip)
        .limit(parseInt(limit))
        .toArray();

      res.send({
        success: true,
        result,
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
        currentPage: parseInt(page)
      });
    });

    // Product details
    app.get('/products/:id', async (req, res) => {
      const id = req.params.id;
      if (!ObjectId.isValid(id)) {
        return res.status(400).send({
          error: true,
          message: "Invalid product ID format. Must be a 24-character hex string."
        });
      }
      const query = { _id: new ObjectId(id) }

      const result = await productsCollection.findOne(query);

      if (!result) {
        return res.send({ notFound: true });
      }
      res.send(result)
    })

    // Latest products
    app.get('/latest-products', async (req, res) => {
      const result = await productsCollection.find().sort({ exportAt: -1 }).limit(6).toArray()
      res.send(result)
    })
    // Top rated products
    app.get('/top-rated-products', async (req, res) => {
      const result = await productsCollection.find().sort({ rating: -1 }).toArray()
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

    app.post('/imports/:id', async (req, res) => {
      try {
        const id = req.params.id;
        if (!ObjectId.isValid(id)) {
          return res.status(400).send({ message: "Invalid product ID format." });
        }

        const importQuantity = parseInt(req.body.userQuantity);
        if (isNaN(importQuantity) || importQuantity <= 0) {
          return res.status(400).send({ message: "Invalid import quantity." });
        }

        const result = await importCollection.insertOne(req.body);

        const query = { _id: new ObjectId(id) };
        const update = { $inc: { availableQuantity: -importQuantity } };
        const remainQuantity = await productsCollection.updateOne(query, update);

        res.send({ success: true, result, remainQuantity });
      } catch (error) {
        console.error("Update error:", error);
        res.status(500).send({ message: error.message });
      }
    });


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


    // -----------------------------

    app.get('/dashboard/summary', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.send({ error: true });

        const totalProducts = await productsCollection.countDocuments();
        const myExports = await productsCollection.countDocuments({ exportBy: email });
        const myImports = await importCollection.countDocuments({ importBy: email });

        res.send({
          totalProducts,
          myExports,
          myImports
        });
      } catch (err) {
        res.status(500).send({ error: true });
      }
    });
    // import analytic api
    // Import analytics API - FIXED
    app.get('/dashboard/import-analytics', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.send([]);

        // Get all imports for this user
        const userImports = await importCollection.find({ importBy: email }).toArray();

        if (userImports.length === 0) {
          return res.send([]);
        }

        // Group by category manually since productId may not exist in products
        const categoryMap = {};

        for (const importItem of userImports) {
          const category = importItem.category || "Uncategorized";

          if (!categoryMap[category]) {
            categoryMap[category] = {
              count: 0,
              totalQuantity: 0
            };
          }

          categoryMap[category].count += 1;
          categoryMap[category].totalQuantity += parseInt(importItem.userQuantity || 0);
        }

        // Convert to array format for chart
        const formattedResult = Object.keys(categoryMap).map(category => ({
          category,
          count: categoryMap[category].count,
          totalQuantity: categoryMap[category].totalQuantity
        }));

        res.send(formattedResult);
      } catch (err) {
        console.error("Import analytics error:", err);
        res.status(500).send([]);
      }
    });

    // Monthly imports API - SIMPLIFIED
    app.get('/dashboard/monthly-imports', async (req, res) => {
      try {
        const email = req.query.email;
        if (!email) return res.send([]);

        const userImports = await importCollection.find({ importBy: email }).toArray();

        // Create monthly data
        const monthData = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
          "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        userImports.forEach(item => {
          try {
            const date = new Date(item.exportAt || item.createdAt || new Date());
            const month = date.getMonth(); // 0-11

            if (!monthData[month]) {
              monthData[month] = {
                count: 0,
                totalValue: 0
              };
            }

            monthData[month].count += 1;
            monthData[month].totalValue += (parseFloat(item.price) || 0) *
              (parseInt(item.userQuantity) || 1);
          } catch (e) {
            console.log("Date parsing error:", e);
          }
        });

        // Format result
        const formattedResult = Object.keys(monthData).map(monthIdx => ({
          month: monthNames[parseInt(monthIdx)] || `Month ${parseInt(monthIdx) + 1}`,
          count: monthData[monthIdx].count,
          totalValue: monthData[monthIdx].totalValue
        })).sort((a, b) => {
          // Sort by month index
          const monthA = monthNames.indexOf(a.month);
          const monthB = monthNames.indexOf(b.month);
          return monthA - monthB;
        });

        // Fill missing months with zero values
        const completeResult = monthNames.map((monthName, index) => {
          const existing = formattedResult.find(item => item.month === monthName);
          return existing || {
            month: monthName,
            count: 0,
            totalValue: 0
          };
        });

        res.send(completeResult);
      } catch (err) {
        console.error("Monthly imports error:", err);
        res.status(500).send([]);
      }
    });

    app.get('/dashboard/recent-imports', async (req, res) => {
      const email = req.query.email;
      const result = await importCollection
        .find({ importBy: email })
        .sort({ exportAt: -1 })
        .limit(3)
        .toArray();

      res.send(result);
    });

    app.get('/dashboard/recent-exports', async (req, res) => {
      const email = req.query.email;
      const result = await productsCollection
        .find({ exportBy: email })
        .sort({ exportAt: -1 })
        .limit(3)
        .toArray();

      res.send(result);
    });







    // ping
    // await client.db("admin").command({ ping: 1 });
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